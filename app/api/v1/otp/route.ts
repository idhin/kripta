import { NextResponse } from "next/server";
import { authenticateApiToken } from "@/lib/server/apiauth";
import { getUserOtpCodes } from "@/lib/server/apiotp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API publik read-only: kembalikan kode OTP saat ini untuk semua akun user.
 * Autentikasi via header: Authorization: Bearer kripta_<tid>.<K>
 */
export async function GET(request: Request) {
  const res = await authenticateApiToken(request);
  if (!res.ok) return res.response;

  const items = await getUserOtpCodes(res.auth.user.id, res.auth.vaultKey);
  return NextResponse.json({ items });
}
