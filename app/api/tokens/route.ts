import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { guardMutation, jsonError, jsonOk, parseBody, requireAuth } from "@/lib/server/http";
import { apiTokenCreateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireAuth();
  if (!res.ok) return res.response;

  const tokens = await prisma.apiToken.findMany({
    where: { userId: res.auth.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true, expiresAt: true },
  });
  return jsonOk({ tokens });
}

export async function POST(request: Request) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;
  if (!(await consumeRate("mutate", res.auth.user.id))) {
    return jsonError("Terlalu banyak permintaan.", 429);
  }

  const body = await parseBody(request, apiTokenCreateSchema);
  if (!body.ok) return body.response;

  const token = await prisma.apiToken.create({
    data: {
      userId: res.auth.user.id,
      name: body.data.name,
      tokenHash: body.data.tokenHash,
      wrappedVaultKey: body.data.wrappedVaultKey,
    },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true, expiresAt: true },
  });

  await audit("token.created", { userId: res.auth.user.id, meta: { tokenId: token.id } });
  return jsonOk({ token });
}
