import { prisma } from "@/lib/server/db";
import { jsonOk, requireSuperadmin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      ip: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });
  return jsonOk({ logs });
}
