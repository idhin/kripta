import "server-only";
import { prisma } from "./db";

/** Apakah Kripta sudah dipasang (ada minimal satu user). */
export async function isInstalled(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}
