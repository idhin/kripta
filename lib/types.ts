export type OtpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export type OtpType = "totp" | "hotp";

/**
 * Bagian rahasia sebuah akun OTP. Objek inilah yang dienkripsi dengan vaultKey
 * di browser dan disimpan sebagai ciphertext di server.
 */
export interface OtpSecretPayload {
  /** Nama layanan, contoh: "GitHub" */
  issuer: string;
  /** Identitas akun, contoh: "user@mail.com" */
  label: string;
  /** Secret dalam format Base32 */
  secret: string;
  type: OtpType;
  algorithm: OtpAlgorithm;
  digits: number;
  /** Periode detik untuk TOTP */
  period: number;
  /** Counter untuk HOTP */
  counter: number;
}

/** Akun OTP versi UI: metadata dari server + payload hasil dekripsi. */
export interface OtpAccount extends OtpSecretPayload {
  id: string;
  /** Urutan tampilan (dari server). */
  order: number;
  createdAt: number;
}

export interface GeneratedCode {
  code: string;
  /** Sisa detik sebelum kode berganti (TOTP) */
  remaining: number;
  /** Total periode (TOTP) */
  period: number;
}

/** Ringkasan user untuk konteks sesi di klien. */
export interface SessionUser {
  id: string;
  email: string;
  role: "SUPERADMIN" | "USER";
}
