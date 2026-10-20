# V-Vault backend

V-Vault is a local-only password manager backend. It is an Express/TypeScript
service that listens on `127.0.0.1` only. It does not call cloud services,
remote databases, or external APIs.

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
- The vault payload and every stored password/history value use AES-256-GCM
  with a fresh random IV and authentication tag.
- The cleartext vault metadata contains only the Argon2id verification hash and
  salt. It never contains the derived key.
- The unlock session is never persisted. Restarting the process requires an
  unlock again.
- All `/cards`, `/accounts`, and `/passwords` routes return `423 Locked` until
  the one app-level unlock succeeds.
- Account list responses never contain passwords. The decrypted current
  password is returned only by `GET /accounts/:id` while unlocked. History is
  returned by its explicitly requested history endpoint.
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

Deletes the card, all of its accounts, and all account history.

```bash
curl -i -X DELETE http://127.0.0.1:3765/cards/<card-uuid>
```

Response: `204 No Content`.
