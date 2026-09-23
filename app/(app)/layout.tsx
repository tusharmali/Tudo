import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOwnerId } from "@/lib/owner";
import Shell from "./Shell";
import Toaster from "@/components/Toaster";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isOwner = user.sub === (await getOwnerId());
  return (
    <>
      <Shell user={user} isOwner={isOwner}>{children}</Shell>
      <Toaster />
      <ServiceWorkerRegister />
    </>
  );
}
