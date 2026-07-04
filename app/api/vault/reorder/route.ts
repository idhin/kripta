import { prisma } from "@/lib/server/db";
import { guardMutation, jsonOk, parseBody, requireAuth } from "@/lib/server/http";
import { reorderSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  const body = await parseBody(request, reorderSchema);
  if (!body.ok) return body.response;

  const owned = await prisma.vaultItem.findMany({
    where: { userId: res.auth.user.id },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((o) => o.id));

  const updates = body.data.ids
    .filter((id) => ownedSet.has(id))
    .map((id, index) =>
      prisma.vaultItem.update({ where: { id }, data: { order: index } })
    );

  await prisma.$transaction(updates);
  return jsonOk();
}
