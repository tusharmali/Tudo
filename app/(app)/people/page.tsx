import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listUsers } from "@/lib/users";
import { twofaEnabled } from "@/lib/twofa";
import { emailConfigured } from "@/lib/email";
import { listGeoExemptIds } from "@/lib/attendance";
import { getOwnerId } from "@/lib/owner";
import PeopleClient from "./PeopleClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const users = await listUsers();
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();
  const twofa = await twofaEnabled();
  const ownerId = await getOwnerId();
  const geoExempt = await listGeoExemptIds();

  // Hierarchy: director → super-admins → HR → dept admins → members (Tech, Support, Digi, …).
  const roleRank: Record<string, number> = { director: 0, superadmin: 1, hr: 2, deptadmin: 3, employee: 4 };
  const deptRank: Record<string, number> = { Tech: 0, Support: 1, Digi: 2 };
  const sorted = [...users].sort((a, b) => {
    const rr = (roleRank[a.role] ?? 5) - (roleRank[b.role] ?? 5);
    if (rr) return rr;
    const dr = (deptRank[a.department] ?? 9) - (deptRank[b.department] ?? 9);
    if (dr) return dr;
    return a.name.localeCompare(b.name);
  });

  return (
    <PeopleClient
      me={{ id: user.sub, role: user.role }}
      departments={departments}
      twofa={twofa}
      emailReady={emailConfigured()}
      ownerId={ownerId}
      geoExempt={geoExempt}
      users={sorted.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        status: u.status || "active",
        color: u.avatarColor,
        avatar: u.avatar,
        manageDepts: u.manageDepts,
      }))}
    />
  );
}
