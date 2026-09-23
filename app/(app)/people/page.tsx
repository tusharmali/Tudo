import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listUsers } from "@/lib/users";
import PeopleClient from "./PeopleClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const users = await listUsers();
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();

  return (
    <PeopleClient
      me={{ id: user.sub, role: user.role }}
      departments={departments}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        status: u.status || "active",
        color: u.avatarColor,
      }))}
    />
  );
}
