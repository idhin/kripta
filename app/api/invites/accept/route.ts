import { prisma } from "@/lib/server/db";
import { hashAuthHash } from "@/lib/server/argon";
import { createSession, getClientMeta } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk, parseBody } from "@/lib/server/http";
import { inviteAcceptSchema } from "@/lib/server/validation";
import { hashToken } from "@/lib/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { ip } = getClientMeta();
  if (!(await consumeRate("invite", ip ?? "unknown"))) {
    return jsonError("Terlalu banyak percobaan.", 429);
  }

  const body = await parseBody(request, inviteAcceptSchema);
  if (!body.ok) return body.response;
  const d = body.data;

  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(d.token) } });
  if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) {
    return jsonError("Invite tidak valid atau sudah kedaluwarsa.", 400);
  }
  if (invite.email && invite.email !== d.email) {
    return jsonError("Email tidak sesuai dengan undangan.", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return jsonError("Email sudah terdaftar.", 409);

  const [authHash, recoveryAuthHash] = await Promise.all([
    hashAuthHash(d.authHash),
    hashAuthHash(d.recoveryAuthHash),
  ]);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: d.email,
        role: invite.role,
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
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedById: created.id },
    });
    return created;
  });

  const { csrfSecret } = await createSession(user.id);
  await audit("invite.accepted", { userId: user.id, meta: { inviteId: invite.id } });

  return jsonOk({
    user: { id: user.id, email: user.email, role: user.role },
    csrf: csrfSecret,
  });
}
