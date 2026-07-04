import { prisma } from "@/lib/server/db";
import { hashAuthHash, verifyAuthHash } from "@/lib/server/argon";
import { audit } from "@/lib/server/audit";
import { guardMutation, jsonError, jsonOk, parseBody, requireAuth } from "@/lib/server/http";
import { passwordChangeSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ganti password: verifikasi password lama, set material baru, cabut sesi lain. */
export async function POST(request: Request) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  const body = await parseBody(request, passwordChangeSchema);
  if (!body.ok) return body.response;
  const d = body.data;

  const valid = await verifyAuthHash(res.auth.user.authHash, d.currentAuthHash);
  if (!valid) return jsonError("Password saat ini salah.", 401);

  const newAuthHash = await hashAuthHash(d.newAuthHash);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: res.auth.user.id },
      data: { authHash: newAuthHash, kdfSalt: d.kdfSalt, kdfParams: d.kdfParams, protectedVaultKey: d.protectedVaultKey },
    }),
    prisma.session.updateMany({
      where: { userId: res.auth.user.id, revokedAt: null, id: { not: res.auth.session.id } },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit("account.password_changed", { userId: res.auth.user.id });
  return jsonOk();
}
