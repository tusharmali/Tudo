import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listUsers } from "@/lib/users";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = isManager(user.role);
  const users = isAdmin ? (await listUsers()).map((u) => ({ id: u.id, name: u.name, email: u.email })) : [];
  return <AccountClient name={user.name} isAdmin={isAdmin} users={users} />;
}
