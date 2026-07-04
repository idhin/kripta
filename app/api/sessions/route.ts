import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { guardMutation, jsonOk, requireAuth } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireAuth();
  if (!res.ok) return res.response;

  const sessions = await prisma.session.findMany({
    where: { userId: res.auth.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, ip: true, userAgent: true, createdAt: true, idleExpiresAt: true },
  });
  return jsonOk({ sessions, currentSessionId: res.auth.session.id });
}

/** Cabut semua sesi lain kecuali yang sedang dipakai. */
export async function DELETE() {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  await prisma.session.updateMany({
    where: { userId: res.auth.user.id, revokedAt: null, id: { not: res.auth.session.id } },
    data: { revokedAt: new Date() },
  });
  await audit("session.revoked", { userId: res.auth.user.id, meta: { scope: "others" } });
  return jsonOk();
}
