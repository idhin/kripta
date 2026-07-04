import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Hashing sisi server untuk `authHash` yang dikirim klien.
 * Catatan: `authHash` sudah merupakan hasil Argon2id + SHA-256 berentropi tinggi
 * di browser; lapisan ini mencegah nilai di DB dipakai ulang langsung bila bocor.
 * @node-rs/argon2 memakai Argon2id secara default.
 */
const OPTIONS = {
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashAuthHash(authHash: string): Promise<string> {
  return hash(authHash, OPTIONS);
}

export async function verifyAuthHash(stored: string, authHash: string): Promise<boolean> {
  try {
    return await verify(stored, authHash);
  } catch {
    return false;
  }
}
