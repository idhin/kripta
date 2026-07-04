<div align="center">

<img src="public/icon.svg" width="88" height="88" alt="Kripta logo" />

# Kripta

**A self-hosted, zero-knowledge, multi-user 2FA/TOTP authenticator.**
The Google Authenticator replacement that you own and control. Every OTP secret is encrypted on your device before it ever reaches the server.

[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white)
![Encryption](https://img.shields.io/badge/encryption-zero--knowledge-6366f1)

<br />

<img src="docs/screenshots/vault-dark.png" width="820" alt="Kripta vault" />

</div>

## Overview

Kripta is a private vault for your two-factor authentication codes. Add accounts by scanning a QR code, uploading a QR image, or entering the secret manually, then generate TOTP and HOTP codes on any device you sign in from.

Unlike most authenticators, Kripta is **zero-knowledge**: your master password, encryption keys, and OTP secrets never leave the browser in plaintext. The server only ever stores hashes and ciphertext, so even a compromised server, or a curious administrator, cannot read your codes.

## Why Kripta

Most authenticators either lock your secrets to a single device or hand your data to a third-party cloud. Kripta gives you both convenience and control:

- **Zero-knowledge by design.** Secrets are encrypted client-side with a key derived from your password. The server sees only ciphertext.
- **Self-hosted.** Run it on your own infrastructure with Docker and PostgreSQL.
- **Multi-user.** One installation for your whole team, with invite-based provisioning and role-based access.
- **Synced across devices.** Open the same vault from anywhere by signing in. No manual export or import.

## Features

- **Flexible entry.** Add accounts via QR scan (camera), QR image upload, or manual input. Supports TOTP and HOTP, SHA-1/256/512, 6 to 8 digits, and custom periods.
- **Fast day-to-day use.** Real-time codes with a countdown ring, one-click copy, drag-to-reorder, and a command palette (`Cmd`/`Ctrl` + `K`) for instant search and copy.
- **First-run setup wizard.** Create the superadmin account the first time you deploy.
- **Invitations.** Add users with optional email pinning, User or Superadmin roles, and link expiry.
- **Mandatory recovery codes.** The only way to recover access if you forget your password. The server cannot reset it for you.
- **Admin dashboard.** Manage users, invitations, and a full audit log.
- **Account management.** Change your password without re-encrypting items, review and revoke active sessions.
- **Polished UI.** English and Bahasa Indonesia, light and dark themes, responsive layout (desktop sidebar, mobile bottom navigation).

## Screenshots

|  |  |
| :---: | :---: |
| **Vault (light)** | **Command palette** |
| <img src="docs/screenshots/vault-light.png" alt="Vault light theme" /> | <img src="docs/screenshots/command-palette.png" alt="Command palette" /> |
| **Settings and language** | **Admin audit log** |
| <img src="docs/screenshots/settings.png" alt="Settings" /> | <img src="docs/screenshots/admin.png" alt="Admin audit log" /> |

## Security model

Kripta uses a Bitwarden-style key hierarchy, derived entirely on the client:

```
password --Argon2id(salt)--> masterKey --HKDF--> stretchedKey --> wraps vaultKey
                               |
                               +--SHA-256--> authHash --> (server) Argon2id(authHash)

vaultKey (random 32B) --AES-GCM by stretchedKey--> protectedVaultKey            (stored on server)
vaultKey             --AES-GCM by recoveryKey (from recovery code)--> protectedVaultKeyByRecovery
each OTP item        --AES-GCM by vaultKey--> ciphertext                          (stored on server)
```

**What the server stores:** `Argon2id(authHash)`, `Argon2id(recoveryAuthHash)`, KDF salt and parameters (public), `protectedVaultKey`, `protectedVaultKeyByRecovery`, and item ciphertext. It never stores passwords, secrets, or keys in plaintext.

**Additional hardening:**

- Database-backed sessions that can be revoked, with `httpOnly` + `Secure` + `SameSite=Strict` cookies and idle plus absolute timeouts.
- CSRF protection with a session-bound double-submit token, plus origin checks.
- Rate limiting and exponential account lockout on login, invites, and recovery, with user-enumeration mitigation at prelogin.
- Strict security headers including a nonce-based Content Security Policy, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`.
- Argon2id for server hashing and client KDF (at least 64 MiB memory), `zod` input validation, ownership checks on every endpoint, and an audit log that never records secrets.

> **Accepted trade-off:** codes are generated only in the browser, and forgetting your password **without** a recovery code means the data is permanently lost. That is the price of true zero-knowledge.

## Quick start (Docker)

Prerequisites: Docker and Docker Compose.

```bash
git clone https://github.com/idhin/kripta.git
cd kripta

# Create the .env file used by docker compose (change the password!)
cat > .env <<'EOF'
POSTGRES_USER=kripta
POSTGRES_PASSWORD=change-this-to-a-strong-password
POSTGRES_DB=kripta
APP_URL=http://localhost:3000
AUTH_COOKIE_SECURE=false
APP_PORT=3000
EOF

docker compose up -d --build
```

Open `http://localhost:3000`. You will be redirected to **/install** to create the superadmin. Save the **recovery code** that is shown.

> **Production:** put Kripta behind an HTTPS reverse proxy (Caddy, Nginx, or Traefik), then set `APP_URL=https://your-domain` and `AUTH_COOKIE_SECURE=true`.

## Local development

Prerequisites: Node 20+, and PostgreSQL (or the `docker run` command below).

```bash
npm install

# Run a local Postgres
docker run -d --name kripta-pg \
  -e POSTGRES_USER=kripta -e POSTGRES_PASSWORD=kripta -e POSTGRES_DB=kripta \
  -p 5432:5432 postgres:16-alpine

cp .env.example .env         # adjust DATABASE_URL if needed
npm run db:migrate           # apply migrations
npm run dev                  # http://localhost:3000
```

Useful scripts: `npm run db:studio` (Prisma Studio), `npm run db:deploy` (production migrations), `npm run build && npm start`.

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://kripta:kripta@localhost:5432/kripta?schema=public` |
| `APP_URL` | Public app URL, used for origin checks and invite links | `http://localhost:3000` |
| `AUTH_COOKIE_SECURE` | Set to `true` only when served over HTTPS | `false` |
| `SESSION_ABSOLUTE_TTL` | Absolute session lifetime, in seconds | `2592000` (30 days) |
| `SESSION_IDLE_TTL` | Idle session lifetime, in seconds | `43200` (12 hours) |

## Backup

Just back up the database. It only contains ciphertext and hashes:

```bash
docker compose exec db pg_dump -U kripta kripta > kripta-backup.sql
```

## Tech stack

Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Zustand, Prisma, PostgreSQL, `@node-rs/argon2` (server), `hash-wasm` and Web Crypto (client), `otpauth`, `qr-scanner`, and `zod`.

## Contributing

Issues and pull requests are welcome. If you find a security concern, please open a private report rather than a public issue.

## License

MIT © Khulafaur Rasyidin. See [LICENSE](LICENSE).
