import { getCurrentUser } from "@/lib/auth";
import { listReleases } from "@/lib/releases";
import ReleasesClient from "./ReleasesClient";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const user = await getCurrentUser();
  const releases = await listReleases();
  return <ReleasesClient releases={releases} isAdmin={user?.role === "superadmin"} />;
}
