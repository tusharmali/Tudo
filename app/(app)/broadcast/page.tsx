import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listAll } from "@/lib/notifications";
import BroadcastClient from "./BroadcastClient";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const user = await getCurrentUser();
  if (user?.role !== "superadmin") redirect("/dashboard");

  const recent = (await listAll()).slice(0, 10).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    when: (n.createdAt || "").slice(0, 16).replace("T", " "),
  }));

  return <BroadcastClient recent={recent} />;
}
