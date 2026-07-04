#!/bin/sh
set -e

echo "[kripta] Menjalankan migrasi database..."
npx prisma migrate deploy

echo "[kripta] Memulai aplikasi..."
exec "$@"
