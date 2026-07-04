import { redirect } from "next/navigation";
import { isInstalled } from "@/lib/server/state";
import { InstallWizard } from "@/components/auth/InstallWizard";

export const dynamic = "force-dynamic";

export default async function InstallPage() {
  if (await isInstalled()) redirect("/login");
  return <InstallWizard />;
}
