"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { votePollAction } from "@/app/actions/polls";
import { toast } from "@/components/Toaster";

type PollCard = { id: string; question: string; options: string[]; closesAt: string; myVote: string };

function closesIn(iso: string): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "closing…";
  const h = Math.floor(ms / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  return h > 0 ? `closes in ${h}h ${m}m` : `closes in ${m}m`;
}

export default function DashboardPolls({ polls }: { polls: PollCard[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [voted, setVoted] = useState<Record<string, string>>(() => Object.fromEntries(polls.map((p) => [p.id, p.myVote])));

  async function vote(pollId: string, option: string) {
    setBusy(pollId + option);
    setVoted((v) => ({ ...v, [pollId]: option })); // optimistic
    const r = await votePollAction({ pollId, option });
    if (r.ok) { toast(r.message || "Recorded"); router.refresh(); }
    else toast(r.error || "Error");
    setBusy("");
  }

  return (
    <div className="stack" style={{ gap: 12, marginBottom: 18 }}>
      {polls.map((p) => {
        const mine = voted[p.id] || "";
        return (
          <div className="card pad" key={p.id} style={{ borderLeft: "3px solid var(--accent)" }}>
            <div className="between" style={{ gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div className="row" style={{ gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 18 }}>📊</span>
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>{p.question}</div>
              </div>
              <span className="tiny faint">{p.closesAt ? closesIn(p.closesAt) : "quick poll"}{mine ? " · your answer saved ✓" : ""}</span>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {p.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`btn ${mine === o ? "btn-primary" : "btn-ghost"}`}
                  style={{ padding: "8px 14px", fontSize: 13 }}
                  disabled={busy === p.id + o}
                  onClick={() => vote(p.id, o)}
                >
                  {mine === o ? "✓ " : ""}{o}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
