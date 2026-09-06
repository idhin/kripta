import "server-only";
import { prisma } from "./db";
import { decryptVaultItem } from "./vaultcrypto";
import { generateCode } from "@/lib/totp";

export interface ApiOtpEntry {
  id: string;
  issuer: string;
  label: string;
  type: "totp" | "hotp";
  code: string;
  remaining: number;
  period: number;
}

/**
 * Membuka seluruh item vault user dengan vaultKey lalu menghasilkan kode saat ini.
 * Item yang gagal didekripsi dilewati diam-diam.
 */
export async function getUserOtpCodes(
  userId: string,
  vaultKey: Uint8Array,
  now: number = Date.now()
): Promise<ApiOtpEntry[]> {
  const items = await prisma.vaultItem.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    select: { id: true, ciphertext: true, nonce: true, order: true },
  });

  const out: ApiOtpEntry[] = [];
  for (const item of items) {
    try {
      const payload = await decryptVaultItem(item.ciphertext, item.nonce, vaultKey);
      const { code, remaining, period } = generateCode(
        { ...payload, id: item.id, order: item.order, createdAt: 0 },
        now
      );
      out.push({
        id: item.id,
        issuer: payload.issuer,
        label: payload.label,
        type: payload.type,
        code,
        remaining,
        period,
      });
    } catch {
      // Lewati item yang gagal didekripsi.
    }
  }
  return out;
}
