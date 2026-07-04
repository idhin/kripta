import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { guardMutation, jsonError, jsonOk, parseBody, requireSuperadmin } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  if (params.id === res.auth.user.id) {
    return jsonError("Tidak bisa mengubah status akun sendiri.", 400);
  }

  const body = await parseBody(request, patchSchema);
  if (!body.ok) return body.response;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return jsonError("User tidak ditemukan.", 404);

  await prisma.$transaction([
    prisma.user.update({ where: { id: params.id }, data: { status: body.data.status } }),
    // Nonaktifkan = cabut semua sesi aktif user tersebut.
    ...(body.data.status === "DISABLED"
      ? [
          prisma.session.updateMany({
            where: { userId: params.id, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]
      : []),
  ]);

  await audit(body.data.status === "DISABLED" ? "user.disabled" : "user.enabled", {
    userId: res.auth.user.id,
    meta: { targetId: params.id },
  });
  return jsonOk();
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  if (params.id === res.auth.user.id) {
    return jsonError("Tidak bisa menghapus akun sendiri.", 400);
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return jsonError("User tidak ditemukan.", 404);

  if (target.role === "SUPERADMIN") {
    const superadmins = await prisma.user.count({ where: { role: "SUPERADMIN" } });
    if (superadmins <= 1) return jsonError("Harus ada minimal satu superadmin.", 400);
  }

  await prisma.user.delete({ where: { id: params.id } });
  await audit("user.deleted", { userId: res.auth.user.id, meta: { targetId: params.id } });
  return jsonOk();
}
