import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listAssets, ASSET_TYPES, ASSET_STATUSES } from "@/lib/assets";
import { listUsers } from "@/lib/users";
import AssetsClient from "./AssetsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManager(user.role)) redirect("/dashboard");

  const [assets, users] = await Promise.all([listAssets(), listUsers()]);
  const people = users.map((u) => ({ id: u.id, name: u.name }));

  return <AssetsClient assets={assets} people={people} types={ASSET_TYPES} statuses={ASSET_STATUSES} />;
}
