import "server-only";
import { createHash } from "crypto";
import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import { unwrapVaultKey } from "./vaultcrypto";
import { consumeRate } from "./ratelimit";

const TOKEN_PREFIX = "kripta_";
const LAST_USED_THROTTLE_MS = 60_000;

function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Ambil "Bearer <token>" dari header Authorization. */
function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim();
}

export interface ApiAuthResult {
  user: User;
  vaultKey: Uint8Array;
  tokenId: string;
}

/**
 * Autentikasi request API publik memakai token "kripta_<tid>.<K>".
 * Server melihat vaultKey hanya sesaat di memori (dibuka dengan K dari token),
 * tidak pernah menyimpan K.
 */
export async function authenticateApiToken(
  request: Request
): Promise<{ ok: true; auth: ApiAuthResult } | { ok: false; response: NextResponse }> {
  const raw = extractBearer(request);
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) {
    return { ok: false, response: apiError("Token tidak valid.", 401) };
  }

  const body = raw.slice(TOKEN_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot <= 0 || dot >= body.length - 1) {
    return { ok: false, response: apiError("Token tidak valid.", 401) };
  }
  const tid = body.slice(0, dot);
  const k = body.slice(dot + 1);

  const tokenHash = sha256hex(tid);

  // Rate limit per token sebelum kerja berat.
  if (!(await consumeRate("api", tokenHash))) {
    return { ok: false, response: apiError("Terlalu banyak permintaan.", 429) };
  }

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  const now = Date.now();
  if (
    !token ||
    token.revokedAt ||
    (token.expiresAt && token.expiresAt.getTime() < now) ||
    token.user.status !== "ACTIVE"
  ) {
    return { ok: false, response: apiError("Token tidak valid.", 401) };
  }

  let vaultKey: Uint8Array;
  try {
    vaultKey = await unwrapVaultKey(token.wrappedVaultKey, k);
  } catch {
    return { ok: false, response: apiError("Token tidak valid.", 401) };
  }

  if (!token.lastUsedAt || now - token.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.apiToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined);
  }

  return { ok: true, auth: { user: token.user, vaultKey, tokenId: token.id } };
}
