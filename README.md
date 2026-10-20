# V-Vault 🔐

**A local-only, open-source password manager — your passwords never leave your device.**

Notepad shows every password you own to anyone who opens the file. V-Vault shows only the one you asked for, only after you unlock it — and nothing ever leaves your machine.

---

## Why V-Vault?

- **Local-only by design** — no cloud, no account to create, no server to trust. Your vault is a single encrypted file on your own computer.
- **One gate, then freedom** — you unlock once, when the app opens. Inside, everything is one click away. Close the app and the vault locks itself again.
- **Cards, not chaos** — organise credentials into simple white cards named by *you* ("Google", "Office Mail", "My Bank" — whatever you write is what the card says; no logos, no guessing).
- **Full password history** — every password change is kept with its date and time, so an old password is never lost.
- **Deleted something by mistake?** — the Recycle Bin keeps deleted cards and accounts restorable for 30 days.
- **Strong passwords on tap** — a built-in generator creates a strong password and saves it in one click.

## Features

- 🔓 Unlock once at app open with a master password; auto-lock after 5 minutes idle
- 🗂️ Card-grid home — create cards with the `+` button and name them anything
- 👤 Accounts inside each card — email, username and password, click-to-copy (clipboard auto-clears)
- 🕘 Password history with date + time for every account
- 🎲 Strong password generator using secure randomness
- ✏️ Custom fields and notes on every account (website, recovery codes, anything) — secret fields are encrypted individually
- 🗑️ Recycle Bin — deleted accounts/cards can be restored for 30 days, then are purged automatically
- 📋 Activity Log — setup, unlocks, changes and deletions inside the vault, with date + time
- 📥 Import from Chrome / Bitwarden CSV — bring your existing passwords in minutes (duplicates are skipped, the CSV is parsed in memory only)
- 🛡️ Leak Check — checks a password against known data breaches using k-anonymity: only the first 5 characters of the password's SHA-1 hash ever leave your device
- 🎨 4 themes — Royal Violet, **Ocean Teal (default)**, Sunset Warm, Midnight — cards stay clean white in every theme

## How it works

```
Master password ──► Argon2id ──► 256-bit key (memory only)
                                    │
                                    ▼
                          AES-256-GCM encryption
                                    │
                                    ▼
                      db/vault.vault  (encrypted file only)
```

- Passwords are **never** stored in plain text — not in the vault file, not in logs, not in browser storage.
- The derived key exists only in process memory while the vault is unlocked, and is wiped on lock, on app close, or after 5 minutes idle.
- The only cleartext metadata is the Argon2id salt and verification hash — never the key, never a password.
- If you forget your master password, the vault cannot be recovered. That is not a bug — it is what makes it safe.
- Windows Hello is integrated through a verifier boundary: the operating system's Windows Security prompt is triggered by the app shell, and the backend only ever receives the verified result — never your Windows password.

## Project structure

```
V-Vault/
├── backend/    TypeScript + Express API — local only, 127.0.0.1:3765 (see backend/README.md)
├── frontend/   React + TypeScript + Vite + Tailwind — the app UI (see frontend/README.md)
└── db/         Shared types & Zod schemas (index.ts) + your encrypted vault (vault.vault)
```

> ⚠️ `db/vault.vault` is **your** vault. It is git-ignored and must never be committed — this repository contains code only, never anyone's passwords.

## Getting started

**Requirement:** Node.js `22.23.3` (pinned in `.nvmrc`) and npm.

Two terminals — one for the backend, one for the frontend:

**Terminal 1 — backend**

```bash
cd backend
npm ci
npm run dev        # http://127.0.0.1:3765
```

Check it is alive: open http://127.0.0.1:3765/vault/status — you should see JSON like `{"isSetup":false,"isUnlocked":false}`.

**Terminal 2 — frontend**

```bash
cd frontend
npm ci
npm run dev        # http://127.0.0.1:5173
```

Open http://127.0.0.1:5173 in your browser.

**First run:** create your master password on the Setup screen → the vault is created → unlock, and start adding cards with the `+` button.

**Run the backend tests:**

```bash
cd backend
npm test           # uses a temporary vault — never touches your real one
```

**Optional — backend in Docker** (build from the repository root, so both `backend/` and `db/` are included):

```bash
docker build -f backend/Dockerfile -t v-vault-backend .
docker run --rm --network host -v "$(pwd)/db:/app/db" v-vault-backend
```

The backend binds to loopback even inside the container, and the vault stays outside the image via the bind mount.

## Tech stack

| Part     | Tech                                                 |
| -------- | ---------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS             |
| Backend  | Node.js, Express 5, TypeScript, Zod                  |
| Storage  | Single encrypted vault file — no database server     |
| Crypto   | Argon2id (key derivation) · AES-256-GCM (encryption) · Node `crypto` (password generation) |

## Roadmap

- [ ] Zero-knowledge encrypted backup — the sealed vault file backed up to the user's own cloud storage, so a lost/corrupt laptop is not "game over", while no server can ever read a password
- [ ] One-click desktop app with a *small* installer — exploring Wails / Tauri (system WebView2) instead of Electron, to keep the app around ~10 MB instead of ~300 MB
- [ ] Browser extension for auto-fill
- [ ] Mobile app

## Security notes

- The backend listens on **127.0.0.1 only** — it is not reachable from your network or the internet, and all data routes return `423 Locked` until the vault is unlocked.
- Leak Check is the only feature that uses the internet, and it sends only a 5-character hash prefix (k-anonymity) — never a password, never a full hash.
- Imported CSV files are parsed in memory only: never written to disk, never logged. Delete the CSV after importing — unlike your vault, it is not protected.

## License & credits

Built for a buildathon — open for everyone to use, learn from, and improve. Contributions are welcome: open an issue or a pull request.
