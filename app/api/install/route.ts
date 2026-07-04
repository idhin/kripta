import { prisma } from "@/lib/server/db";
import { hashAuthHash } from "@/lib/server/argon";
import { createSession, getClientMeta } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk, parseBody } from "@/lib/server/http";
import { installSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const count = await prisma.user.count();
  return jsonOk({ installed: count > 0 });
}

export async function POST(request: Request) {
  const userCount = await prisma.user.count();
  if (userCount > 0) return jsonError("Kripta sudah terpasang.", 409);

  const { ip } = getClientMeta();
  if (!(await consumeRate("install", ip ?? "unknown"))) {
    return jsonError("Terlalu banyak percobaan. Coba lagi nanti.", 429);
  }

  const body = await parseBody(request, installSchema);
  if (!body.ok) return body.response;
  const d = body.data;

  const [authHash, recoveryAuthHash] = await Promise.all([
    hashAuthHash(d.authHash),
    hashAuthHash(d.recoveryAuthHash),
  ]);

  const user = await prisma.user.create({
    data: {
      email: d.email,
      role: "SUPERADMIN",
      status: "ACTIVE",
      authHash,
      recoveryAuthHash,
      kdfSalt: d.kdfSalt,
      kdfParams: d.kdfParams,
      protectedVaultKey: d.protectedVaultKey,
      protectedVaultKeyByRecovery: d.protectedVaultKeyByRecovery,
      lastLoginAt: new Date(),
    },
  });

  const { csrfSecret } = await createSession(user.id);
  await audit("install.superadmin_created", { userId: user.id, meta: { email: user.email } });

  return jsonOk({
    user: { id: user.id, email: user.email, role: user.role },
    csrf: csrfSecret,
  });
}
