import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getClientMeta } from "./auth";

export type AuditAction =
  | "install.superadmin_created"
  | "auth.login_success"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.locked_out"
  | "invite.created"
  | "invite.revoked"
  | "invite.accepted"
  | "user.disabled"
  | "user.enabled"
  | "user.deleted"
  | "account.password_changed"
  | "account.recovered"
  | "session.revoked"
  | "vault.item_created"
  | "vault.item_updated"
  | "vault.item_deleted";

/** Mencatat event keamanan. `meta` tidak boleh berisi secret/plaintext OTP. */
export async function audit(
  action: AuditAction,
  opts: { userId?: string | null; meta?: Record<string, unknown> } = {}
): Promise<void> {
  const client = getClientMeta();
  await prisma.auditLog
    .create({
      data: {
        action,
        userId: opts.userId ?? null,
        ip: client.ip ?? undefined,
        userAgent: client.userAgent ?? undefined,
        meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch(() => undefined);
}
