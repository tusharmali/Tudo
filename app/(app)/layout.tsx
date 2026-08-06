import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Shell from "./Shell";
import Toaster from "@/components/Toaster";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <Shell user={user}>{children}</Shell>
      <Toaster />
      <ServiceWorkerRegister />
    </>
  );
}
