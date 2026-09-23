import { getCurrentUser } from "@/lib/auth";
import { getFunState, listContributions } from "@/lib/fun";
import { usersMap } from "@/lib/users";
import FunClient from "./FunClient";

export const dynamic = "force-dynamic";

export default async function FunPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [{ enabled, title }, contribs, umap] = await Promise.all([
    getFunState(),
    listContributions(),
    usersMap(),
  ]);

  const contributions = contribs.map((c) => ({
    id: c.userId,
    name: umap[c.userId]?.name || "Someone",
    color: umap[c.userId]?.avatarColor || "#7178DD",
    avatar: umap[c.userId]?.avatar || "",
    content: c.content,
  }));

  return <FunClient enabled={enabled} title={title} isAdmin={user.role === "superadmin"} contributions={contributions} />;
}
