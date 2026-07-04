import { prisma } from "@/lib/server/db";
import { getClientMeta } from "@/lib/server/auth";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk } from "@/lib/server/http";
import { hashToken } from "@/lib/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cek validitas token invite untuk halaman /invite/[token]. */
export async function GET(request: Request) {
  const { ip } = getClientMeta();
  if (!(await consumeRate("invite", ip ?? "unknown"))) {
    return jsonError("Terlalu banyak percobaan.", 429);
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return jsonOk({ valid: false });

  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) {
    return jsonOk({ valid: false });
  }
  return jsonOk({ valid: true, email: invite.email, role: invite.role });
}
