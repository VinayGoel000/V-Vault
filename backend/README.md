# V-Vault backend

V-Vault is a local-only password manager backend. It is an Express/TypeScript
service that listens on `127.0.0.1` only. Imports are processed in memory. The
optional password leak check makes a k-anonymity request to the Have I Been
Pwned Passwords API; only the first five characters of a SHA-1 hash are sent.

The backend owns no copy of the data model. Types, Zod schemas, and the default
vault path are imported from the repository-root `db/` folder. The encrypted
vault is stored at `db/vault.vault` and is ignored by git.

## Requirements

- Node.js `22.23.3` (the version is pinned in `.nvmrc`)
- npm

## Install, build, run, and test

From the repository root:

```bash
cd backend
npm ci
npm run build
npm test
npm start
```

The development server uses `tsx watch`:

```bash
npm run dev
```

The default port is `3765`. A different valid port can be selected with
`PORT`, while the bind address remains `127.0.0.1`:

```bash
PORT=4000 npm start
```

`npm test` is the single backend test command. The tests use a temporary vault
file and do not touch the user's real vault.

## Docker

Build from the repository root so Docker can copy both `backend/` and `db/`:

```bash
docker build -f backend/Dockerfile -t v-vault-backend .
```

The application intentionally binds to loopback, including inside the
container. On Linux, run it with the host network and mount the repository's
database directory so the vault survives container recreation:

```bash
docker run --rm --network host \
  -v "$(pwd)/db:/app/db" \
  v-vault-backend
```

Do not bake `db/vault.vault` into an image. The provided `.dockerignore` and
the bind mount keep the vault outside image layers.

## Security model

- The master password is verified with Argon2id.
- A 32-byte Argon2id-derived key exists only in the process memory while the
  vault is unlocked. It is wiped when the vault is locked or the five-minute
  inactivity timer fires.
- The vault payload, every stored password/history value, secret custom field,
  activity event, and leak-check cache use AES-256-GCM with a fresh random IV
  and authentication tag.
- The cleartext vault metadata contains only the Argon2id verification hash and
  salt. It never contains the derived key.
- The unlock session is never persisted. Restarting the process requires an
  unlock again.
- All `/cards`, `/accounts`, and `/passwords` routes return `423 Locked` until
  the one app-level unlock succeeds.
- Account list responses never contain passwords. The decrypted current
  password is returned only by `GET /accounts/:id` while unlocked. History is
  returned by its explicitly requested history endpoint.
- Account notes are limited to 2,000 characters. Accounts support an optional
  `websiteUrl` and up to 50 custom fields. Custom fields marked `secret` (or
  `isSecret` in a request) are encrypted individually and are masked in list
  responses; their cleartext is returned only by the account detail endpoint.
- Account and card deletion moves data to the encrypted recycle bin. Normal
  list/detail queries omit deleted records. Deleted records are purged after
  30 days when the vault is unlocked. Use `GET /recycle-bin`,
  `POST /recycle-bin/{cards|accounts}/:id/restore`, and
  `DELETE /recycle-bin/{cards|accounts}/:id` for restore and permanent delete.
- Activity events are encrypted and retained newest-first, with a maximum of
  500 events. `GET /activity` returns the decrypted event list only while the
  vault is unlocked. Events contain metadata and never passwords or import
  rows.
- `WindowsHelloVerifier` is only an adapter boundary. Windows Hello must be
  started by the frontend/Electron layer; this backend never receives a
  Windows password, PIN, or biometric value.

## API

Use this base URL for all examples:

```text
http://127.0.0.1:3765
```

Successful JSON responses use the shapes shown below. Error responses always
have the form `{ "error": "..." }`; request validation is `400`, bad master
password is `401`, missing resources are `404`, duplicate setup is `409`, and
locked data routes are `423`.

### Vault lifecycle

#### `POST /vault/setup`

First-time setup only. It does not unlock the new vault.

```bash
curl -X POST http://127.0.0.1:3765/vault/setup \
  -H 'content-type: application/json' \
  -d '{"masterPassword":"<master-password>"}'
```

Response `201`:

```json
{ "message": "Vault setup complete" }
```

If `db/vault.vault` already exists, response `409` is returned.

#### `POST /vault/unlock`

The only authentication gate. The session and decryption key are kept in
memory only.

```bash
curl -X POST http://127.0.0.1:3765/vault/unlock \
  -H 'content-type: application/json' \
  -d '{"masterPassword":"<master-password>"}'
```

Response `200`:

```json
{ "message": "Vault unlocked" }
```

An incorrect master password returns `401`.

#### `POST /vault/lock`

Wipes the in-memory key and session immediately.

```bash
curl -X POST http://127.0.0.1:3765/vault/lock
```

Response `200`:

```json
{ "message": "Vault locked" }
```

#### `GET /vault/status`

Returns no password data, keys, or session token.

```bash
curl http://127.0.0.1:3765/vault/status
```

Response `200`:

```json
{ "isSetup": true, "isUnlocked": true }
```

### Cards

All card routes require an unlocked vault.

Account creation accepts `email` and `password` plus optional `username`,
`websiteUrl`, `notes`, and `customFields`. Accounts without a username are
returned with the username omitted.

#### `POST /cards`

```bash
curl -X POST http://127.0.0.1:3765/cards \
  -H 'content-type: application/json' \
  -d '{"name":"Google"}'
```

Response `201`:

```json
{
  "card": {
    "id": "<card-uuid>",
    "name": "Google",
    "createdAt": "<iso-date>",
    "updatedAt": "<iso-date>"
  }
}
```

#### `GET /cards`

```bash
curl http://127.0.0.1:3765/cards
```

Response `200`:

```json
{
  "cards": [
    {
      "id": "<card-uuid>",
      "name": "Google",
      "createdAt": "<iso-date>",
      "updatedAt": "<iso-date>",
      "accountCount": 1
    }
  ]
}
```

#### `PATCH /cards/:id`

```bash
curl -X PATCH http://127.0.0.1:3765/cards/<card-uuid> \
  -H 'content-type: application/json' \
  -d '{"name":"Google renamed"}'
```

Response `200` is `{ "card": { "id": "<card-uuid>", "name": "Google renamed", "createdAt": "<iso-date>", "updatedAt": "<iso-date>" } }`.

#### `DELETE /cards/:id`

Moves the card and its active accounts to the recycle bin. Account history is
retained with the deleted records until restore or the 30-day purge.

```bash
curl -i -X DELETE http://127.0.0.1:3765/cards/<card-uuid>
```

Response: `204 No Content`.

### Account fields

`POST /cards/:cardId/accounts` accepts:

```json
{
  "email": "person@example.com",
  "username": "optional-username",
  "password": "account-password",
  "websiteUrl": "https://example.com",
  "notes": "Optional notes, up to 2000 characters",
  "customFields": [
    { "key": "Recovery code", "value": "value", "isSecret": true }
  ]
}
```

`username`, `websiteUrl`, `notes`, and `customFields` are optional. Custom
field keys are limited to 50 characters, values to 1000 characters, and each
account may have at most 20 fields. Secret custom-field values are encrypted
individually and are never returned in account list responses. `GET
/accounts/:id` returns decrypted custom-field values while the vault is
unlocked.

`PATCH /accounts/:id` accepts the same optional profile fields. Sending
`websiteUrl: null` or `notes: null` clears that value; sending `customFields`
replaces the complete custom-field collection.

### Recycle Bin

Deletes are soft deletes. `DELETE /cards/:id` moves the card and its accounts
to the Recycle Bin, while `DELETE /accounts/:id` moves one account there.
Normal list/detail queries exclude deleted items.

- `GET /recycle-bin` returns deleted cards and accounts with `deletedAt` and
  `daysLeft`.
- `POST /recycle-bin/cards/:id/restore` restores a card and its accounts.
- `POST /recycle-bin/accounts/:id/restore` restores an account, unless its
  card is still deleted (`409`).
- `DELETE /recycle-bin/cards/:id/permanent` permanently deletes a card and
  its account history.
- `DELETE /recycle-bin/accounts/:id/permanent` permanently deletes an account
  and its history.

Deleted records older than 30 days are purged during unlock.

### Activity, imports, and security

- `GET /activity-log?limit=100` returns the newest activity entries first.
  Entries are stored inside the encrypted vault and contain no passwords or
  password hashes.
- `POST /import/preview` with multipart field `file` returns a masked preview
  for a Chrome or Bitwarden CSV. `POST /import/commit` accepts the same file
  and `previewId` and returns `{ "imported": 4, "skipped": 1 }`. CSV data is
  held in memory only; uploads are limited to 5 MB and 2000 rows.
- `POST /security/leak-check` with `{ "accountId": "<uuid>" }` checks one
  account and returns `{ "status": "leaked|safe|unknown", "count": 0,
  "checkedAt": "<iso-date>" }`.
- `POST /security/leak-check-all` checks every active account. Leak checks
  send only the first five SHA-1 hash characters to HIBP and cache results in
  the encrypted vault for 24 hours. Network failures return `unknown`.

### Account fields

`POST /cards/:cardId/accounts` and `PATCH /accounts/:id` accept:

```json
{
  "email": "person@example.com",
  "username": "person@example.com",
  "password": "a password",
  "websiteUrl": "https://example.com/login",
  "notes": "At most 2000 characters",
  "customFields": [
    { "name": "Account number", "value": "123", "secret": false },
    { "name": "PIN", "value": "1234", "secret": true }
  ]
}
```

`isSecret` is accepted as an input alias for `secret`. A secret custom field
is returned as `"********"` in summaries and decrypted in
`GET /accounts/:id`.

### Recycle bin

```bash
curl http://127.0.0.1:3765/recycle-bin
curl -X POST http://127.0.0.1:3765/recycle-bin/accounts/<account-uuid>/restore
curl -i -X DELETE http://127.0.0.1:3765/recycle-bin/accounts/<account-uuid>
```

The equivalent convenience routes are `POST /accounts/:id/restore`,
`DELETE /accounts/:id/permanent`, `POST /cards/:id/restore`, and
`DELETE /cards/:id/permanent`.

### CSV import

CSV uploads use `multipart/form-data` with any single file field. Both preview
and commit are in-memory and protected by the unlocked-vault gate:

```bash
curl -X POST http://127.0.0.1:3765/import/chrome/preview \
  -F 'file=@chrome.csv'

curl -X POST http://127.0.0.1:3765/import/chrome/commit \
  -H 'content-type: application/json' \
  -d '{"previewId":"<preview-id>"}'
```

`/imports` is an alias for `/import`. Chrome exports use `name`, `url`,
`username`, `password`, and `note`. Bitwarden exports use `name`,
`login_uri`, `login_username`, `login_password`, `notes`, and `fields`.
Files are limited to 5 MiB and 2,000 data rows. Passwords are masked in the
preview, duplicate rows are skipped rather than overwritten, preview data
expires after ten minutes, and no upload is written to disk or activity logs.

### Password leak checks

```bash
curl -X POST http://127.0.0.1:3765/accounts/<account-uuid>/leak-check
curl -X POST http://127.0.0.1:3765/leak-check-all
```

The response reports `pwned`, `not_pwned`, or `unavailable`. A successful
result is encrypted in the vault for 24 hours and is tied to the current
password. Network failures return `unavailable` safely and do not expose a
password or full hash. The single-account endpoint also accepts `GET` and
`/check-leak`; the all-accounts endpoint accepts `GET` and
`/accounts/leak-check-all`.
