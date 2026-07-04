import { prisma } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { guardMutation, jsonOk, parseBody, requireSuperadmin } from "@/lib/server/http";
import { inviteCreateSchema } from "@/lib/server/validation";
import { generateToken, inviteLink } from "@/lib/server/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      usedBy: { select: { email: true } },
    },
  });
  return jsonOk({ invites });
}

export async function POST(request: Request) {
  const res = await requireSuperadmin();
  if (!res.ok) return res.response;
  const guard = guardMutation(res.auth);
  if (guard) return guard;

  const body = await parseBody(request, inviteCreateSchema);
  if (!body.ok) return body.response;
  const { email, role, expiresInHours } = body.data;

  const { raw, hash } = generateToken();
  const invite = await prisma.invite.create({
    data: {
      tokenHash: hash,
      email: email ?? null,
      role,
      createdById: res.auth.user.id,
      expiresAt: new Date(Date.now() + expiresInHours * 3600_000),
    },
    select: { id: true, email: true, role: true, expiresAt: true },
  });

  await audit("invite.created", { userId: res.auth.user.id, meta: { inviteId: invite.id, role } });

  // Token mentah hanya dikembalikan sekali di sini.
  return jsonOk({ invite: { ...invite, link: inviteLink(raw) } });
}
