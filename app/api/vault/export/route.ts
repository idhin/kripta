import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { guardMutation, jsonError, jsonOk, parseBody, requireAuth } from "@/lib/server/http";
import { vaultExportLogSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hanya mencatat jejak audit ketika user mengekspor vault-nya.
 * Isi export dibentuk dan diunduh sepenuhnya di browser; secret tidak
 * pernah melewati endpoint ini.
 */
export async function POST(request: Request) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;
  if (!(await consumeRate("mutate", res.auth.user.id))) {
    return jsonError("Terlalu banyak permintaan.", 429);
  }

  const body = await parseBody(request, vaultExportLogSchema);
  if (!body.ok) return body.response;

  await audit("vault.exported", {
    userId: res.auth.user.id,
    meta: { format: body.data.format, count: body.data.count },
  });
  return jsonOk();
}
