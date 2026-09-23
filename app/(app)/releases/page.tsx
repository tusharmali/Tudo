import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listReleases } from "@/lib/releases";
import ReleasesClient from "./ReleasesClient";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role) && user.dept !== "Tech") redirect("/dashboard");
  const releases = await listReleases();
  return <ReleasesClient releases={releases} isAdmin={user.role === "superadmin"} />;
}
