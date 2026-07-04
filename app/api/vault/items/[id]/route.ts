import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { consumeRate } from "@/lib/server/ratelimit";
import { guardMutation, jsonError, jsonOk, parseBody, requireAuth } from "@/lib/server/http";
import { itemWriteSchema } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;
  if (!(await consumeRate("mutate", res.auth.user.id))) {
    return jsonError("Terlalu banyak permintaan.", 429);
  }

  const body = await parseBody(request, itemWriteSchema);
  if (!body.ok) return body.response;

  const existing = await prisma.vaultItem.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== res.auth.user.id) {
    return jsonError("Item tidak ditemukan.", 404);
  }

  const item = await prisma.vaultItem.update({
    where: { id: params.id },
    data: { ciphertext: body.data.ciphertext, nonce: body.data.nonce },
    select: { id: true, ciphertext: true, nonce: true, order: true, createdAt: true },
  });

  await audit("vault.item_updated", { userId: res.auth.user.id, meta: { itemId: item.id } });
  return jsonOk({ item });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const res = await requireAuth();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  const existing = await prisma.vaultItem.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== res.auth.user.id) {
    return jsonError("Item tidak ditemukan.", 404);
  }

  await prisma.vaultItem.delete({ where: { id: params.id } });
  await audit("vault.item_deleted", { userId: res.auth.user.id, meta: { itemId: params.id } });
  return jsonOk();
}
