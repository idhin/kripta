import { getAuth, destroySession } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await getAuth();
  await destroySession();
  if (auth) await audit("auth.logout", { userId: auth.user.id });
  return jsonOk();
}
