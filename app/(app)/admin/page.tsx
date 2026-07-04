import { redirect } from "next/navigation";
import { getAuth } from "@/lib/server/auth";
import { AdminView } from "@/components/admin/AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.user.role !== "SUPERADMIN") redirect("/vault");
  return <AdminView />;
}
