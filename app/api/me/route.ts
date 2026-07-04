import { requireAuth } from "@/lib/server/http";
import { jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bootstrap sesi: data user + material kripto untuk membuka kunci di klien. */
export async function GET() {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const { user, session } = res.auth;

  return jsonOk({
    user: { id: user.id, email: user.email, role: user.role },
    kdfSalt: user.kdfSalt,
    kdfParams: user.kdfParams,
    protectedVaultKey: user.protectedVaultKey,
    csrf: session.csrfSecret,
  });
}
