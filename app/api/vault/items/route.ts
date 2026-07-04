import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { guardMutation, jsonError, jsonOk, parseBody, requireAuth } from "@/lib/server/http";
import { itemWriteSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireAuth();
  if (!res.ok) return res.response;

  const items = await prisma.vaultItem.findMany({
    where: { userId: res.auth.user.id },
    orderBy: { order: "asc" },
    select: { id: true, ciphertext: true, nonce: true, order: true, createdAt: true },
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;
  if (!(await consumeRate("mutate", res.auth.user.id))) {
    return jsonError("Terlalu banyak permintaan.", 429);
  }

  const body = await parseBody(request, itemWriteSchema);
  if (!body.ok) return body.response;

  const max = await prisma.vaultItem.aggregate({
    where: { userId: res.auth.user.id },
    _max: { order: true },
  });
  const nextOrder = (max._max.order ?? -1) + 1;

  const item = await prisma.vaultItem.create({
    data: {
      userId: res.auth.user.id,
      ciphertext: body.data.ciphertext,
      nonce: body.data.nonce,
      order: nextOrder,
    },
    select: { id: true, ciphertext: true, nonce: true, order: true, createdAt: true },
  });

  await audit("vault.item_created", { userId: res.auth.user.id, meta: { itemId: item.id } });
  return jsonOk({ item });
}
