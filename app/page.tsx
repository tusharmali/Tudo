import { redirect } from "next/navigation";

// The proxy sends signed-out visitors to /login before they reach here,
// so anyone landing on "/" is authenticated → straight to the dashboard.
export default function Home() {
  redirect("/dashboard");
}
