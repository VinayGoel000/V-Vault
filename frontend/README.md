# V-Vault frontend

The V-Vault frontend is a React + TypeScript + Vite application for the
local-only encrypted backend in `../backend`. It does not persist credentials,
account passwords, generated passwords, or password history in browser storage.
Secret values live only in the active React/browser memory and are cleared when
the app locks or the relevant screen is left.

## Requirements

- Node.js `22.23.3` (pinned in `.nvmrc`)
- npm
- The V-Vault backend running on `http://127.0.0.1:3765`

## Setup and development

From the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open the Vite URL shown in the terminal, normally
`http://127.0.0.1:5173`. Development requests use `/api` and are proxied to
the backend. Set `VITE_BACKEND_URL` before `npm run dev` to proxy to another
local backend port:

```bash
VITE_BACKEND_URL=http://127.0.0.1:4000 npm run dev
```

The backend can be started separately with:

```bash
cd backend
npm ci
npm start
```

For a separately hosted frontend, set `VITE_API_URL` at build time to the
base URL that exposes the backend routes. If it is omitted from a production
build, the client defaults to `http://127.0.0.1:3765`. During Vite development,
the default `/api` path is proxied to that same local backend because the
backend intentionally has no cross-origin or remote/cloud data service.

## Screens and behavior

- **Setup** creates the first vault with a master password, then moves to the
  unlock screen because setup does not unlock the backend session.
- **Unlock** uses the exact backend `{ masterPassword }` request and reports
  backend validation, incorrect-password, and locked-session errors as toasts.
- **Vault** shows a responsive grid of plain white cards. Each card shows only
  the user-entered name and account count; clicking it opens the account list.
- **Account detail** loads the current password directly from the backend,
  supports updating profile fields, changing the password, copying secrets,
  and viewing/revealing password history.
- **Generator** sends the selected character categories and length to the
  backend password generator.
- **Idle lock** calls `POST /vault/lock` after five minutes without frontend
  activity and clears the in-memory frontend vault state. The backend has its
  own five-minute in-memory session timer as well.

## Backend contract used by the typed client

The client uses these exact routes. Data routes require the backend session to
be unlocked and return `{ "error": "..." }` on errors.

| Method | Route | Request / response |
| --- | --- | --- |
| `POST` | `/vault/setup` | Request `{ masterPassword: string }`; response `201 { message: "Vault setup complete" }` |
| `POST` | `/vault/unlock` | Request `{ masterPassword: string }`; response `{ message: "Vault unlocked" }` |
| `POST` | `/vault/lock` | Response `{ message: "Vault locked" }` |
| `GET` | `/vault/status` | Response `{ isSetup: boolean, isUnlocked: boolean }` |
| `POST` | `/cards` | Request `{ name: string }`; response `{ card: Card }` |
| `GET` | `/cards` | Response `{ cards: (Card & { accountCount: number })[] }` |
| `PATCH` | `/cards/:id` | Request `{ name: string }`; response `{ card: Card }` |
| `DELETE` | `/cards/:id` | Response `204` |
| `POST` | `/cards/:cardId/accounts` | Request `{ email, password, username?, notes? }`; response `{ account: AccountSummary }` |
| `GET` | `/cards/:cardId/accounts` | Response `{ accounts: AccountSummary[] }` without passwords |
| `GET` | `/accounts/:id` | Response `{ account: AccountSummary & { password: string } }` |
| `PATCH` | `/accounts/:id` | Request `{ email?, username?, notes?: string \| null }`; response `{ account: AccountSummary }` |
| `DELETE` | `/accounts/:id` | Response `204` |
| `PUT` | `/accounts/:id/password` | Request `{ newPassword: string }`; response `{ message: "Password changed" }` |
| `GET` | `/accounts/:id/history` | Response `{ history: { password: string, changedAt: string }[] }` |
| `POST` | `/passwords/generate` | Request `{ length, uppercase, lowercase, numbers, symbols }`; response `{ password: string }` |

`Card` contains `id`, `name`, `createdAt`, and `updatedAt`. `AccountSummary`
contains `id`, `cardId`, `email`, `username`, optional `notes`, `createdAt`,
and `updatedAt`.

The account `username` field is optional. The UI displays `No username` when
one was not supplied and does not send an empty username during edits.

## WebAuthn / Windows Hello contract caveat

The frontend includes a deliberately safe platform-authenticator adapter. It
can ask the browser to start a platform-authenticator ceremony without reading
or forwarding a Windows PIN, Windows password, biometric value, or credential
payload. It never invents an auth request body.

The actual backend currently exposes only `POST /vault/unlock` with
`{ masterPassword }`. It has no server-issued WebAuthn challenge, credential
registration, assertion verification, or WebAuthn unlock route. Therefore a
completed browser ceremony is reported as an explicit backend
unsupported/mismatch message and does **not** unlock the vault. Master-password
unlock remains the only real authentication path until the backend contract is
extended.

## Build and deploy

Run the offline project check after dependencies are installed:

```bash
npm test
```

`npm test` runs the strict TypeScript check and production Vite build. The
underlying command can also be run directly with `npm run build`.

The production files are written to `frontend/dist`. They can be served by a
static host with SPA fallback to `index.html`; configure that host to expose
the backend under the built `VITE_API_URL` value.

The included Dockerfile builds and serves the static application with nginx:

```bash
docker build -t v-vault-frontend frontend
docker run --rm -p 8080:80 v-vault-frontend
```

The container serves the frontend at `http://127.0.0.1:8080`. A production
reverse proxy must route the configured API base to the loopback backend when
the frontend and backend run in separate containers.

## Additional screens and endpoints

While unlocked, the header includes links for:

- **Recycle Bin** — `GET /recycle-bin`, `POST
  /recycle-bin/cards/:id/restore`, `POST
  /recycle-bin/accounts/:id/restore`, `DELETE
  /recycle-bin/cards/:id/permanent`, and `DELETE
  /recycle-bin/accounts/:id/permanent`. Normal deletes explain that items are
  restorable for 30 days.
- **Activity** — `GET /activity-log?limit=100`, shown as a read-only timeline.
- **Import** — `POST /import/preview` and `POST /import/commit` using a CSV
  multipart upload. The file is previewed with masked passwords and is never
  stored by the frontend.

Account Detail also uses `PATCH /accounts/:id` for website URLs, notes up to
2000 characters, and up to 20 custom fields. Secret custom-field values are
shown only after unlock and copied from in-memory React state.

Leak checks use `POST /security/leak-check` with `{ accountId }` and
`POST /security/leak-check-all`. This is the only feature that uses the
internet. The UI explains that only the first five characters of the SHA-1
password hash are sent; no password is sent from the frontend.

## Themes

The header Settings menu provides Royal Violet, Ocean Teal (default), Sunset
Warm, and Midnight. Theme CSS variables update instantly without a reload.
Only the selected theme name is persisted under the non-secret UI preference
key `v-vault-theme`; passwords and keys are never stored in browser storage.
Vault cards remain plain white cards with dark text in every theme.
