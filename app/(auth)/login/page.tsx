import { redirect } from "next/navigation";
import { isInstalled } from "@/lib/server/state";
import { getAuth } from "@/lib/server/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await isInstalled())) redirect("/install");
  if (await getAuth()) redirect("/vault");
  return <LoginForm />;
}
