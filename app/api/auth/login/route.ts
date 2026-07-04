import { prisma } from "@/lib/server/db";
import { verifyAuthHash } from "@/lib/server/argon";
import { createSession, getClientMeta } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk, parseBody } from "@/lib/server/http";
import { loginSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export async function POST(request: Request) {
  const { ip } = getClientMeta();
  if (!(await consumeRate("login", ip ?? "unknown"))) {
    return jsonError("Terlalu banyak percobaan login. Coba lagi nanti.", 429);
  }

  const body = await parseBody(request, loginSchema);
  if (!body.ok) return body.response;
  const { email, authHash } = body.data;

  const invalid = () => jsonError("Email atau password salah.", 401);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await audit("auth.login_failed", { meta: { email } });
    return invalid();
  }

  if (user.status !== "ACTIVE") return jsonError("Akun dinonaktifkan.", 403);

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await audit("auth.locked_out", { userId: user.id });
    return jsonError("Akun terkunci sementara karena terlalu banyak percobaan gagal.", 429);
  }

  const valid = await verifyAuthHash(user.authHash, authHash);
  if (!valid) {
    const attempts = user.failedAttempts + 1;
    const lockedUntil =
      attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: lockedUntil ? 0 : attempts, lockedUntil },
    });
    await audit("auth.login_failed", { userId: user.id });
    return invalid();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const { csrfSecret } = await createSession(user.id);
  await audit("auth.login_success", { userId: user.id });

  return jsonOk({
    user: { id: user.id, email: user.email, role: user.role },
    protectedVaultKey: user.protectedVaultKey,
    kdfSalt: user.kdfSalt,
    kdfParams: user.kdfParams,
    csrf: csrfSecret,
  });
}
