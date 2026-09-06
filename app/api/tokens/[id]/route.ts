import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { guardMutation, jsonError, jsonOk, requireAuth } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  const existing = await prisma.apiToken.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== res.auth.user.id || existing.revokedAt) {
    return jsonError("Token tidak ditemukan.", 404);
  }

  await prisma.apiToken.update({
    where: { id: params.id },
    data: { revokedAt: new Date() },
  });
  await audit("token.revoked", { userId: res.auth.user.id, meta: { tokenId: params.id } });
  return jsonOk();
}
