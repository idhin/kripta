import { createHash } from "crypto";
import { prisma } from "@/lib/server/db";
import { getClientMeta } from "@/lib/server/auth";
import { consumeRate } from "@/lib/server/ratelimit";
import { jsonError, jsonOk, parseBody } from "@/lib/server/http";
import { preloginSchema } from "@/lib/server/validation";
import { DEFAULT_KDF_PARAMS } from "@/lib/crypto/zk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salt dummy deterministik untuk email tak dikenal (mitigasi user enumeration). */
function dummySalt(email: string): string {
  return createHash("sha256").update(`kripta-dummy-salt|${email}`).digest("base64").slice(0, 24);
}

export async function POST(request: Request) {
  const { ip } = getClientMeta();
  if (!(await consumeRate("login", `pre:${ip ?? "unknown"}`))) {
    return jsonError("Terlalu banyak percobaan. Coba lagi nanti.", 429);
  }

  const body = await parseBody(request, preloginSchema);
  if (!body.ok) return body.response;

  const user = await prisma.user.findUnique({
    where: { email: body.data.email },
    select: { kdfSalt: true, kdfParams: true, status: true },
  });

  // Selalu balas 200 dengan bentuk sama, baik user ada maupun tidak.
  if (!user || user.status !== "ACTIVE") {
    return jsonOk({ kdfSalt: dummySalt(body.data.email), kdfParams: DEFAULT_KDF_PARAMS });
  }
  return jsonOk({ kdfSalt: user.kdfSalt, kdfParams: user.kdfParams });
}
