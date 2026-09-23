import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAll } from "@/lib/notifications";
import { listUsers } from "@/lib/users";
import BroadcastClient from "./BroadcastClient";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const user = await getCurrentUser();
  if (!isManager(user?.role)) redirect("/dashboard");

  const [recentAll, users] = await Promise.all([listAll(), listUsers()]);
  const recent = recentAll.slice(0, 10).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    when: (n.createdAt || "").slice(0, 16).replace("T", " "),
  }));
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();

  return <BroadcastClient recent={recent} departments={departments} />;
}
