import { redirect } from "next/navigation";
import { isInstalled } from "@/lib/server/state";
import { getAuth } from "@/lib/server/auth";
import { AppShell } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  if (!(await isInstalled())) redirect("/install");
  const auth = await getAuth();
  if (!auth) redirect("/login");

  const user = { id: auth.user.id, email: auth.user.email, role: auth.user.role };
  return <AppShell user={user}>{children}</AppShell>;
}
