# Kripta

**Platform 2FA/TOTP self-hosted, zero-knowledge, dan multi-user.** Pengganti Google Authenticator yang kamu kontrol sendiri. Semua secret OTP terenkripsi di perangkatmu sebelum menyentuh server.

![License](https://img.shields.io/badge/license-MIT-emerald)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Zero--Knowledge](https://img.shields.io/badge/encryption-zero--knowledge-brightgreen)

---

## Kenapa Kripta?

Kebanyakan authenticator menyimpan secret di satu perangkat, atau menyerahkan datamu ke cloud pihak ketiga. Kripta menggabungkan yang terbaik dari keduanya:

- **Zero-knowledge**: password, master key, vault key, dan secret OTP **tidak pernah** meninggalkan browser dalam bentuk plaintext. Server hanya menyimpan *hash* dan *ciphertext*. Bahkan superadmin tidak bisa membaca OTP milik user lain.
- **Self-hosted**: jalankan di infrastrukturmu sendiri via Docker + PostgreSQL.
- **Multi-user**: satu instalasi untuk tim, dengan provisioning berbasis undangan.
- **Sinkron antar perangkat**: buka vault yang sama dari mana saja dengan login.

## Fitur

- Simpan TOTP & HOTP, tambah via **scan QR (kamera)**, **unggah gambar QR**, atau **input manual**.
- Kode real-time dengan progress countdown, salin sekali klik, dan **command palette** (`⌘/Ctrl + K`).
- **Setup wizard** sekali-jalan untuk membuat akun superadmin saat pertama deploy.
- **Undangan** untuk menambah user (email opsional, peran User/Superadmin, kedaluwarsa).
- **Recovery code** wajib: satu-satunya jalan pulih bila lupa password (server tidak bisa mereset).
- **Dashboard admin**: kelola pengguna, undangan, dan audit log.
- Ganti password tanpa re-enkripsi item, kelola sesi aktif, tema terang/gelap.
- UI profesional & responsif (sidebar desktop, bottom-nav mobile).

## Model keamanan

Kripta memakai derivasi kunci gaya Bitwarden, sepenuhnya di sisi klien:

```
password ──Argon2id(salt)──▶ masterKey ──HKDF──▶ stretchedKey ──▶ membungkus vaultKey
                               │
                               └─SHA-256──▶ authHash ──▶ (server) Argon2id(authHash)

vaultKey (acak 32B) ──AES-GCM oleh stretchedKey──▶ protectedVaultKey  (disimpan server)
vaultKey ──AES-GCM oleh recoveryKey (dari recovery code)──▶ protectedVaultKeyByRecovery
tiap item OTP ──AES-GCM oleh vaultKey──▶ ciphertext  (disimpan server)
```

Yang disimpan server: `Argon2id(authHash)`, `Argon2id(recoveryAuthHash)`, salt/param KDF (publik), `protectedVaultKey`, `protectedVaultKeyByRecovery`, dan ciphertext item. **Tidak ada** password/secret/kunci dalam bentuk plaintext.

Pertahanan tambahan:

- Sesi DB-backed (bisa dicabut), cookie `httpOnly` + `Secure` + `SameSite=Strict`, idle + absolute timeout.
- Proteksi CSRF (double-submit token terikat sesi) + pengecekan origin.
- Rate limiting & lockout akun eksponensial pada login/invite/recovery; mitigasi user-enumeration di prelogin.
- Security headers ketat termasuk **CSP berbasis nonce**, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- Argon2id untuk hashing (server) & KDF (klien, ≥64 MiB memori), validasi input `zod`, ownership check di semua endpoint, audit log tanpa secret.

> **Konsekuensi yang disepakati:** generate kode hanya terjadi di browser; lupa password **tanpa** recovery code = data hilang permanen.

## Quick start (Docker)

Prasyarat: Docker + Docker Compose.

```bash
git clone https://github.com/idhin/kripta.git
cd kripta

# Buat file .env untuk compose (ganti password!)
cat > .env <<'EOF'
POSTGRES_USER=kripta
POSTGRES_PASSWORD=ganti-dengan-password-kuat
POSTGRES_DB=kripta
APP_URL=http://localhost:3000
AUTH_COOKIE_SECURE=false
APP_PORT=3000
EOF

docker compose up -d --build
```

Buka `http://localhost:3000`. Kamu akan diarahkan ke **/install** untuk membuat superadmin. Simpan **recovery code** yang ditampilkan.

> **Produksi:** letakkan Kripta di belakang reverse proxy HTTPS (Caddy/Nginx/Traefik), set `APP_URL=https://domainmu` dan `AUTH_COOKIE_SECURE=true`.

## Pengembangan lokal

Prasyarat: Node 20+, PostgreSQL (atau `docker run` seperti di bawah).

```bash
npm install

# Jalankan Postgres lokal
docker run -d --name kripta-pg \
  -e POSTGRES_USER=kripta -e POSTGRES_PASSWORD=kripta -e POSTGRES_DB=kripta \
  -p 5432:5432 postgres:16-alpine

cp .env.example .env         # sesuaikan DATABASE_URL bila perlu
npm run db:migrate           # terapkan migrasi
npm run dev                  # http://localhost:3000
```

Skrip berguna: `npm run db:studio` (Prisma Studio), `npm run db:deploy` (migrasi produksi), `npm run build && npm start`.

## Backup

Cukup backup database, isinya hanya ciphertext & hash:

```bash
docker compose exec db pg_dump -U kripta kripta > kripta-backup.sql
```

## Tech stack

Next.js 14 (App Router) · React · TypeScript · Tailwind CSS · Zustand · Prisma · PostgreSQL · `@node-rs/argon2` (server) · `hash-wasm` + Web Crypto (klien) · `otpauth` · `qr-scanner` · `zod`.

## Lisensi

MIT © Khulafaur Rasyidin. Lihat [LICENSE](LICENSE).
