import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { listBroadcasts } from "@/lib/notifications";
import { listPolls, allVotes, tally, pollIsOpen } from "@/lib/polls";
import { listUsers } from "@/lib/users";
import BroadcastClient from "./BroadcastClient";
import PollsPanel from "./PollsPanel";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const user = await getCurrentUser();
  if (!isManager(user?.role)) redirect("/dashboard");

  const [recentAll, users, polls, votes] = await Promise.all([listBroadcasts(), listUsers(), listPolls(), allVotes()]);
  const recent = recentAll.slice(0, 10).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    when: (n.createdAt || "").slice(0, 16).replace("T", " "),
  }));
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();
  const umap: Record<string, string> = {};
  for (const u of users) umap[u.id] = u.name;

  const pollViews = polls.map((p) => {
    const audience = p.target === "all" ? users : users.filter((u) => u.department === p.target);
    const t = tally(p, votes, audience);
    return {
      id: p.id,
      question: p.question,
      options: p.options,
      target: p.target,
      closesAt: p.closesAt,
      open: pollIsOpen(p),
      counts: t.counts,
      responded: t.responded.map((id) => ({ id, name: umap[id] || "Someone", option: t.byUser[id] })),
      notResponded: t.notResponded.map((id) => ({ id, name: umap[id] || "Someone" })),
      total: audience.length,
    };
  });

  return (
    <>
      <BroadcastClient recent={recent} departments={departments} />
      <PollsPanel polls={pollViews} departments={departments} />
    </>
  );
}
