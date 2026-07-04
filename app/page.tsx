import { redirect } from "next/navigation";
import { isInstalled } from "@/lib/server/state";
import { getAuth } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!(await isInstalled())) redirect("/install");
  const auth = await getAuth();
  redirect(auth ? "/vault" : "/login");
}
