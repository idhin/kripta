import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth, verifyCsrf, verifyOrigin, type AuthContext } from "./auth";

export function jsonOk(data: unknown = { ok: true }, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Parse & validasi body JSON dengan skema zod. */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError("Body JSON tidak valid.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("Validasi gagal.", 422, { issues: parsed.error.flatten() }),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Wajib login. Mengembalikan konteks auth atau response 401. */
export async function requireAuth(): Promise<{ ok: true; auth: AuthContext } | { ok: false; response: NextResponse }> {
  const auth = await getAuth();
  if (!auth) return { ok: false, response: jsonError("Tidak terautentikasi.", 401) };
  return { ok: true, auth };
}

/** Wajib login + superadmin. */
export async function requireSuperadmin(): Promise<
  { ok: true; auth: AuthContext } | { ok: false; response: NextResponse }
> {
  const res = await requireAuth();
  if (!res.ok) return res;
  if (res.auth.user.role !== "SUPERADMIN") {
    return { ok: false, response: jsonError("Akses ditolak.", 403) };
  }
  return res;
}

/** Proteksi CSRF + origin untuk request mutasi ter-autentikasi. */
export function guardMutation(auth: AuthContext): NextResponse | null {
  if (!verifyOrigin()) return jsonError("Origin tidak valid.", 403);
  if (!verifyCsrf(auth.session)) return jsonError("Token CSRF tidak valid.", 403);
  return null;
}
