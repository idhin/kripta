import * as OTPAuth from "otpauth";
import type { GeneratedCode, OtpAccount, OtpAlgorithm } from "./types";

function normalizeSecret(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase();
}

function buildTotp(account: OtpAccount): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: account.issuer,
    label: account.label,
    algorithm: account.algorithm,
    digits: account.digits,
    period: account.period,
    secret: OTPAuth.Secret.fromBase32(normalizeSecret(account.secret)),
  });
}

function buildHotp(account: OtpAccount): OTPAuth.HOTP {
  return new OTPAuth.HOTP({
    issuer: account.issuer,
    label: account.label,
    algorithm: account.algorithm,
    digits: account.digits,
    counter: account.counter,
    secret: OTPAuth.Secret.fromBase32(normalizeSecret(account.secret)),
  });
}

/** Menghasilkan kode saat ini beserta sisa waktu untuk sebuah akun. */
export function generateCode(account: OtpAccount, now: number = Date.now()): GeneratedCode {
  if (account.type === "hotp") {
    const hotp = buildHotp(account);
    return {
      code: hotp.generate(),
      remaining: account.period,
      period: account.period,
    };
  }

  const totp = buildTotp(account);
  const code = totp.generate({ timestamp: now });
  const period = account.period;
  const elapsed = Math.floor(now / 1000) % period;
  const remaining = period - elapsed;
  return { code, remaining, period };
}

/** Memvalidasi apakah string secret Base32 valid. */
export function isValidSecret(secret: string): boolean {
  try {
    const normalized = normalizeSecret(secret);
    if (normalized.length === 0) return false;
    OTPAuth.Secret.fromBase32(normalized);
    return true;
  } catch {
    return false;
  }
}

export interface ParsedOtp {
  issuer: string;
  label: string;
  secret: string;
  type: "totp" | "hotp";
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  counter: number;
}

/**
 * Mem-parse otpauth:// URI (hasil scan QR) menjadi data akun.
 * Contoh: otpauth://totp/GitHub:user@mail.com?secret=XXXX&issuer=GitHub&digits=6&period=30
 */
export function parseOtpUri(uri: string): ParsedOtp {
  const parsed = OTPAuth.URI.parse(uri.trim());
  const isHotp = parsed instanceof OTPAuth.HOTP;

  const algorithm = (parsed.algorithm as OtpAlgorithm) ?? "SHA1";

  return {
    issuer: parsed.issuer || "",
    label: parsed.label || "",
    secret: parsed.secret.base32,
    type: isHotp ? "hotp" : "totp",
    algorithm,
    digits: parsed.digits ?? 6,
    period: isHotp ? 30 : (parsed as OTPAuth.TOTP).period ?? 30,
    counter: isHotp ? (parsed as OTPAuth.HOTP).counter ?? 0 : 0,
  };
}

/** Membangun otpauth:// URI dari akun (untuk export / tampil QR). */
export function buildOtpUri(account: OtpAccount): string {
  const common = {
    issuer: account.issuer,
    label: account.label || account.issuer,
    algorithm: account.algorithm,
    digits: account.digits,
    secret: OTPAuth.Secret.fromBase32(normalizeSecret(account.secret)),
  };
  const otp =
    account.type === "hotp"
      ? new OTPAuth.HOTP({ ...common, counter: account.counter })
      : new OTPAuth.TOTP({ ...common, period: account.period });
  return otp.toString();
}
