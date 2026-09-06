import "server-only";
import type { OtpSecretPayload } from "@/lib/types";

/**
 * Dekripsi sisi-server untuk jalur API token.
 *
 * Format mengikuti persis klien di lib/crypto/zk.ts:
 *   - blob terbungkus: "v1.<ivB64>.<ctB64>" (base64 standar), AES-GCM, IV 12 byte.
 *   - item OTP: { ciphertext: base64(ct), nonce: base64(iv) }, plaintext = JSON payload.
 *
 * Kunci K (pembungkus vaultKey) hanya datang dari string token per-request dan
 * TIDAK PERNAH disimpan. Server hanya dapat membuka vaultKey saat token hadir.
 */

const IV_LEN = 12;

const subtle = globalThis.crypto.subtle;

/** Salin ke ArrayBuffer murni agar cocok dengan tipe BufferSource. */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function unpackBlob(blob: string): { iv: Uint8Array; ct: Uint8Array } {
  const parts = blob.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Format blob tidak valid.");
  return {
    iv: new Uint8Array(Buffer.from(parts[1], "base64")),
    ct: new Uint8Array(Buffer.from(parts[2], "base64")),
  };
}

async function aesGcmDecrypt(keyBytes: Uint8Array, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  if (keyBytes.length !== 32) throw new Error("Panjang kunci tidak valid.");
  if (iv.length !== IV_LEN) throw new Error("Panjang IV tidak valid.");
  const key = await subtle.importKey("raw", buf(keyBytes), { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(ct));
  return new Uint8Array(pt);
}

/** Membuka vaultKey dari wrappedVaultKey memakai kunci K (base64url dari token). */
export async function unwrapVaultKey(wrappedBlob: string, kB64url: string): Promise<Uint8Array> {
  const k = new Uint8Array(Buffer.from(kB64url, "base64url"));
  const { iv, ct } = unpackBlob(wrappedBlob);
  return aesGcmDecrypt(k, iv, ct);
}

/** Mendekripsi satu item OTP menjadi payload rahasia dengan vaultKey. */
export async function decryptVaultItem(
  ciphertext: string,
  nonce: string,
  vaultKey: Uint8Array
): Promise<OtpSecretPayload> {
  const iv = new Uint8Array(Buffer.from(nonce, "base64"));
  const ct = new Uint8Array(Buffer.from(ciphertext, "base64"));
  const pt = await aesGcmDecrypt(vaultKey, iv, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as OtpSecretPayload;
}
