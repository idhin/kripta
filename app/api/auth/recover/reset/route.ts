import { prisma } from "@/lib/server/db";
import { hashAuthHash, verifyAuthHash } from "@/lib/server/argon";
import { getClientMeta } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk, parseBody } from "@/lib/server/http";
import { recoveryResetSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reset password via recovery code: set material auth baru, cabut semua sesi. */
export async function POST(request: Request) {
  const { ip } = getClientMeta();
  if (!(await consumeRate("recovery", ip ?? "unknown"))) {
    return jsonError("Terlalu banyak percobaan. Coba lagi nanti.", 429);
  }

  const body = await parseBody(request, recoveryResetSchema);
  if (!body.ok) return body.response;
  const d = body.data;

  const user = await prisma.user.findUnique({ where: { email: d.email } });
  const invalid = () => jsonError("Recovery code atau email salah.", 401);
  if (!user || user.status !== "ACTIVE") return invalid();

  const valid = await verifyAuthHash(user.recoveryAuthHash, d.recoveryAuthHash);
  if (!valid) return invalid();

  const newAuthHash = await hashAuthHash(d.newAuthHash);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        authHash: newAuthHash,
        kdfSalt: d.kdfSalt,
        kdfParams: d.kdfParams,
        protectedVaultKey: d.protectedVaultKey,
        failedAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit("account.recovered", { userId: user.id });
  return jsonOk();
}
