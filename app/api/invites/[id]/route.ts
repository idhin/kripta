import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { guardMutation, jsonError, jsonOk, requireSuperadmin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cabut (hapus) invite yang belum dipakai. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  const invite = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!invite) return jsonError("Invite tidak ditemukan.", 404);
  if (invite.usedAt) return jsonError("Invite sudah dipakai.", 409);

  await prisma.invite.delete({ where: { id: params.id } });
  await audit("invite.revoked", { userId: res.auth.user.id, meta: { inviteId: params.id } });
  return jsonOk();
}
