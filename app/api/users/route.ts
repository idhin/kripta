import { prisma } from "@/lib/server/db";
import { jsonOk, requireSuperadmin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { vaultItems: true } },
    },
  });
  return jsonOk({ users, currentUserId: res.auth.user.id });
}
