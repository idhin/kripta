"use client";

/**
 * Inti kriptografi zero-knowledge Kripta (berjalan di BROWSER).
 *
 * Alur kunci (gaya Bitwarden):
 *   password --Argon2id(salt)--> masterKey (32B)
 *   masterKey --HKDF--> stretchedKey (32B, untuk membungkus vaultKey)
 *   masterKey --SHA-256--> authHash (dikirim ke server; server re-hash dengan Argon2id)
 *   vaultKey (acak 32B) --AES-GCM oleh stretchedKey--> protectedVaultKey
 *   recoveryCode --HKDF--> recoveryKey; vaultKey --AES-GCM oleh recoveryKey--> protectedVaultKeyByRecovery
 *   tiap item OTP --AES-GCM oleh vaultKey--> ciphertext
 *
 * Server TIDAK PERNAH menerima password, masterKey, vaultKey, atau plaintext OTP.
 */

import { argon2id } from "hash-wasm";

export interface KdfParams {
  alg: "argon2id";
  v: 1;
  /** memory dalam KiB */
  m: number;
  /** iterations */
  t: number;
  /** parallelism */
  p: number;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
  alg: "argon2id",
  v: 1,
  m: 65536, // 64 MiB
  t: 3,
  p: 1,
};

const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;

// ---------- util encoding ----------

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Salin ke ArrayBuffer murni agar cocok dengan tipe BufferSource. */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

// ---------- primitif ----------

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", buf(data));
  return new Uint8Array(digest);
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(enc.encode(info)) },
    baseKey,
    KEY_LEN * 8
  );
  return new Uint8Array(bits);
}

async function aesGcmEncrypt(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const key = await crypto.subtle.importKey("raw", buf(keyBytes), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = randomBytes(IV_LEN);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(plaintext));
  return { iv, ct: new Uint8Array(ct) };
}

async function aesGcmDecrypt(keyBytes: Uint8Array, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(keyBytes), { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(ct));
  return new Uint8Array(pt);
}

/** Bungkus {iv, ct} menjadi satu string terformat: "v1.<ivB64>.<ctB64>". */
function packBlob(iv: Uint8Array, ct: Uint8Array): string {
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

function unpackBlob(blob: string): { iv: Uint8Array; ct: Uint8Array } {
  const parts = blob.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Format blob tidak valid.");
  return { iv: fromB64(parts[1]), ct: fromB64(parts[2]) };
}

// ---------- derivasi kunci ----------

async function deriveMasterKey(password: string, saltB64: string, params: KdfParams): Promise<Uint8Array> {
  const hash = await argon2id({
    password: enc.encode(password),
    salt: fromB64(saltB64),
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: KEY_LEN,
    outputType: "binary",
  });
  return hash as Uint8Array;
}

async function deriveStretchedKey(masterKey: Uint8Array): Promise<Uint8Array> {
  return hkdf(masterKey, enc.encode("kripta-stretch-v1"), "vault-key-wrap");
}

async function computeAuthHash(masterKey: Uint8Array): Promise<string> {
  const domain = enc.encode("kripta-auth-v1");
  const combined = new Uint8Array(domain.length + masterKey.length);
  combined.set(domain, 0);
  combined.set(masterKey, domain.length);
  return toB64(await sha256(combined));
}

// ---------- recovery code ----------

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa karakter ambigu

/** Membuat recovery code acak berentropi tinggi: 8 grup x 5 karakter. */
export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 8; g++) {
    const rnd = randomBytes(5);
    let s = "";
    for (let i = 0; i < 5; i++) s += RECOVERY_ALPHABET[rnd[i] % RECOVERY_ALPHABET.length];
    groups.push(s);
  }
  return groups.join("-");
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

async function deriveRecoveryKey(code: string): Promise<Uint8Array> {
  const normalized = normalizeRecoveryCode(code);
  return hkdf(enc.encode(normalized), enc.encode("kripta-recovery-v1"), "vault-key-wrap");
}

async function computeRecoveryAuthHash(recoveryKey: Uint8Array): Promise<string> {
  const domain = enc.encode("kripta-recovery-auth-v1");
  const combined = new Uint8Array(domain.length + recoveryKey.length);
  combined.set(domain, 0);
  combined.set(recoveryKey, domain.length);
  return toB64(await sha256(combined));
}

export interface RecoveryCredentials {
  recoveryKey: Uint8Array;
  recoveryAuthHash: string;
}

/** Menurunkan kredensial recovery dari kode yang dimasukkan user saat pemulihan. */
export async function deriveRecoveryCredentials(code: string): Promise<RecoveryCredentials> {
  const recoveryKey = await deriveRecoveryKey(code);
  const recoveryAuthHash = await computeRecoveryAuthHash(recoveryKey);
  return { recoveryKey, recoveryAuthHash };
}

// ---------- API tingkat tinggi ----------

export interface AccountCryptoMaterial {
  kdfSalt: string;
  kdfParams: KdfParams;
  authHash: string;
  recoveryAuthHash: string;
  protectedVaultKey: string;
  protectedVaultKeyByRecovery: string;
  recoveryCode: string;
  /** vaultKey mentah untuk dipakai di sesi saat ini (jangan dikirim ke server). */
  vaultKey: Uint8Array;
}

/** Menyiapkan seluruh material kripto untuk akun baru (install/invite). */
export async function createAccountCrypto(password: string): Promise<AccountCryptoMaterial> {
  const kdfParams = DEFAULT_KDF_PARAMS;
  const kdfSalt = toB64(randomBytes(SALT_LEN));

  const masterKey = await deriveMasterKey(password, kdfSalt, kdfParams);
  const stretchedKey = await deriveStretchedKey(masterKey);
  const authHash = await computeAuthHash(masterKey);

  const vaultKey = randomBytes(KEY_LEN);

  const wrapPw = await aesGcmEncrypt(stretchedKey, vaultKey);
  const protectedVaultKey = packBlob(wrapPw.iv, wrapPw.ct);

  const recoveryCode = generateRecoveryCode();
  const recoveryKey = await deriveRecoveryKey(recoveryCode);
  const recoveryAuthHash = await computeRecoveryAuthHash(recoveryKey);
  const wrapRec = await aesGcmEncrypt(recoveryKey, vaultKey);
  const protectedVaultKeyByRecovery = packBlob(wrapRec.iv, wrapRec.ct);

  return {
    kdfSalt,
    kdfParams,
    authHash,
    recoveryAuthHash,
    protectedVaultKey,
    protectedVaultKeyByRecovery,
    recoveryCode,
    vaultKey,
  };
}

export interface LoginDerivation {
  authHash: string;
  masterKey: Uint8Array;
}

/** Menurunkan authHash + masterKey saat login (masterKey dipakai membuka vaultKey). */
export async function deriveLogin(password: string, kdfSalt: string, kdfParams: KdfParams): Promise<LoginDerivation> {
  const masterKey = await deriveMasterKey(password, kdfSalt, kdfParams);
  const authHash = await computeAuthHash(masterKey);
  return { authHash, masterKey };
}

/** Membuka vaultKey menggunakan masterKey (hasil login). */
export async function unlockVaultKey(protectedVaultKey: string, masterKey: Uint8Array): Promise<Uint8Array> {
  const stretchedKey = await deriveStretchedKey(masterKey);
  const { iv, ct } = unpackBlob(protectedVaultKey);
  return aesGcmDecrypt(stretchedKey, iv, ct);
}

/** Membuka vaultKey menggunakan recovery code. */
export async function unlockVaultKeyByRecovery(
  protectedVaultKeyByRecovery: string,
  recoveryCode: string
): Promise<Uint8Array> {
  const recoveryKey = await deriveRecoveryKey(recoveryCode);
  const { iv, ct } = unpackBlob(protectedVaultKeyByRecovery);
  return aesGcmDecrypt(recoveryKey, iv, ct);
}

export interface ReprotectResult {
  kdfSalt: string;
  kdfParams: KdfParams;
  authHash: string;
  protectedVaultKey: string;
}

/**
 * Membungkus ulang vaultKey yang sudah diketahui dengan password baru
 * (dipakai saat ganti password atau reset via recovery). Item tidak perlu re-enkripsi.
 */
export async function reprotectVaultKey(newPassword: string, vaultKey: Uint8Array): Promise<ReprotectResult> {
  const kdfParams = DEFAULT_KDF_PARAMS;
  const kdfSalt = toB64(randomBytes(SALT_LEN));
  const masterKey = await deriveMasterKey(newPassword, kdfSalt, kdfParams);
  const stretchedKey = await deriveStretchedKey(masterKey);
  const authHash = await computeAuthHash(masterKey);
  const wrap = await aesGcmEncrypt(stretchedKey, vaultKey);
  return { kdfSalt, kdfParams, authHash, protectedVaultKey: packBlob(wrap.iv, wrap.ct) };
}

// ---------- enkripsi item OTP ----------

export interface ItemBlob {
  ciphertext: string;
  nonce: string;
}

/** Mengenkripsi objek item OTP dengan vaultKey. */
export async function encryptItem(payload: unknown, vaultKey: Uint8Array): Promise<ItemBlob> {
  const data = enc.encode(JSON.stringify(payload));
  const { iv, ct } = await aesGcmEncrypt(vaultKey, data);
  return { ciphertext: toB64(ct), nonce: toB64(iv) };
}

/** Mendekripsi item OTP dengan vaultKey. */
export async function decryptItem<T>(blob: ItemBlob, vaultKey: Uint8Array): Promise<T> {
  const iv = fromB64(blob.nonce);
  const ct = fromB64(blob.ciphertext);
  const pt = await aesGcmDecrypt(vaultKey, iv, ct);
  return JSON.parse(dec.decode(pt)) as T;
}

// ---------- penyimpanan vaultKey di sesi (sessionStorage) ----------

const VAULT_KEY_STORAGE = "kripta:vk";

/** Simpan vaultKey di sessionStorage (hilang saat tab ditutup). */
export function persistVaultKey(vaultKey: Uint8Array): void {
  try {
    sessionStorage.setItem(VAULT_KEY_STORAGE, toB64(vaultKey));
  } catch {
    /* ignore */
  }
}

export function loadVaultKey(): Uint8Array | null {
  try {
    const v = sessionStorage.getItem(VAULT_KEY_STORAGE);
    return v ? fromB64(v) : null;
  } catch {
    return null;
  }
}

export function clearVaultKey(): void {
  try {
    sessionStorage.removeItem(VAULT_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}
