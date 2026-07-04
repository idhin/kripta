import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { Role, User, Session } from "@prisma/client";
import { prisma } from "./db";

export const SESSION_COOKIE = "kripta_session";
export const CSRF_COOKIE = "kripta_csrf";
export const CSRF_HEADER = "x-csrf-token";

const ABSOLUTE_TTL = Number(process.env.SESSION_ABSOLUTE_TTL ?? 2592000) * 1000; // ms
const IDLE_TTL = Number(process.env.SESSION_IDLE_TTL ?? 43200) * 1000; // ms

function secureCookies(): boolean {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

export function getClientMeta(): ClientMeta {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
  return { ip: ip ?? null, userAgent: h.get("user-agent") };
}

/** Membuat sesi baru dan menaruh cookie httpOnly + cookie CSRF. */
export async function createSession(userId: string): Promise<{ session: Session; csrfSecret: string }> {
  const token = randomBytes(32).toString("base64url");
  const csrfSecret = randomBytes(32).toString("base64url");
  const now = Date.now();
  const meta = getClientMeta();

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256hex(token),
      csrfSecret,
      ip: meta.ip ?? undefined,
      userAgent: meta.userAgent ?? undefined,
      expiresAt: new Date(now + ABSOLUTE_TTL),
      idleExpiresAt: new Date(now + IDLE_TTL),
    },
  });

  const jar = cookies();
  const common = {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict" as const,
    path: "/",
    expires: session.expiresAt,
  };
  jar.set(SESSION_COOKIE, token, common);
  // Cookie CSRF sengaja readable oleh JS (double-submit); tetap SameSite=strict.
  jar.set(CSRF_COOKIE, csrfSecret, { ...common, httpOnly: false });

  return { session, csrfSecret };
}

export interface AuthContext {
  user: User;
  session: Session;
}

/** Mengambil sesi aktif dari cookie, memvalidasi kedaluwarsa & sliding idle. */
export async function getAuth(): Promise<AuthContext | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256hex(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.idleExpiresAt.getTime() < now) {
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;

  // Sliding idle timeout (perbarui bila lewat 1 menit agar tak menulis tiap request).
  const newIdle = new Date(now + IDLE_TTL);
  if (newIdle.getTime() - session.idleExpiresAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { idleExpiresAt: newIdle } });
  }

  return { user: session.user, session };
}

/** Mencabut sesi saat ini dan menghapus cookie. */
export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: sha256hex(token) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  const jar = cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

/**
 * Verifikasi token CSRF untuk request mutasi (double-submit + terikat ke sesi).
 * Header `x-csrf-token` harus sama dengan `csrfSecret` di sesi.
 */
export function verifyCsrf(session: Session): boolean {
  const headerToken = headers().get(CSRF_HEADER);
  if (!headerToken) return false;
  const a = Buffer.from(headerToken);
  const b = Buffer.from(session.csrfSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verifikasi origin request sama dengan APP_URL (pertahanan CSRF tambahan). */
export function verifyOrigin(): boolean {
  const h = headers();
  const origin = h.get("origin");
  if (!origin) return true; // request non-browser / same-origin GET
  const appUrl = process.env.APP_URL;
  if (!appUrl) return true;
  try {
    return new URL(origin).host === new URL(appUrl).host;
  } catch {
    return false;
  }
}

export function isSuperadmin(role: Role): boolean {
  return role === "SUPERADMIN";
}
