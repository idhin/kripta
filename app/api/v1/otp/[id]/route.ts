import { NextResponse } from "next/server";
import { authenticateApiToken } from "@/lib/server/apiauth";
import { getUserOtpCodes } from "@/lib/server/apiotp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API publik read-only: kode OTP saat ini untuk satu akun berdasarkan id.
 * Autentikasi via header: Authorization: Bearer kripta_<tid>.<K>
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const res = await authenticateApiToken(request);
  if (!res.ok) return res.response;

  const items = await getUserOtpCodes(res.auth.user.id, res.auth.vaultKey);
  const item = items.find((i) => i.id === params.id);
  if (!item) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ item });
}
