import { prisma } from "@/lib/server/db";
import { verifyAuthHash } from "@/lib/server/argon";
import { getClientMeta } from "@/lib/server/auth";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk, parseBody } from "@/lib/server/http";
import { recoveryVerifySchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verifikasi recovery code -> kembalikan protectedVaultKeyByRecovery (ciphertext). */
export async function POST(request: Request) {
  const { ip } = getClientMeta();
  if (!(await consumeRate("recovery", ip ?? "unknown"))) {
    return jsonError("Terlalu banyak percobaan. Coba lagi nanti.", 429);
  }

  const body = await parseBody(request, recoveryVerifySchema);
  if (!body.ok) return body.response;

  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  const invalid = () => jsonError("Recovery code atau email salah.", 401);
  if (!user || user.status !== "ACTIVE") return invalid();

  const valid = await verifyAuthHash(user.recoveryAuthHash, body.data.recoveryAuthHash);
  if (!valid) return invalid();

  return jsonOk({ protectedVaultKeyByRecovery: user.protectedVaultKeyByRecovery });
}
