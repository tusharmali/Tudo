"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startBreakAction, endBreakAction } from "@/app/actions/breaks";
import { toast } from "@/components/Toaster";

type OpenBreak = { start: string; since: string };

function fmtElapsed(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export default function BreakControl({
  checkedIn,
  open,
  count = 0,
  earlierMin = 0,
}: {
  checkedIn: boolean;
  open: OpenBreak | null;
  count?: number;
  earlierMin?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const busyRef = useRef(false);

  // Live timer while on a break.
  useEffect(() => {
    if (!open?.since) return;
    const start = new Date(open.since).getTime();
    const tick = () => setElapsed((Date.now() - start) / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [open?.since]);

  if (!checkedIn) return null;

  async function act(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) {
        toast(r.message || "Done");
        router.refresh();
      } else toast(r.error || "Something went wrong");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong");
    }
    busyRef.current = false;
    setBusy(false);
  }

  const cup = (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2.5a2.5 2.5 0 0 1 0 5H17M7 3v2M11 3v2M15 3v2" />
    </svg>
  );

  return (
    <div className={`brk-box${open ? " on" : ""}`}>
      <div className={`brk-ic${open ? " pulse" : ""}`}>{cup}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {open ? (
          <>
            <div className="brk-title">On a break</div>
            <div className="tiny muted">Since {open.start} · <strong style={{ color: "var(--ink)" }}>{fmtElapsed(elapsed)}</strong></div>
          </>
        ) : (
          <>
            <div className="brk-title">Taking a break?</div>
            <div className="tiny muted">
              {count > 0 ? `${count} break${count > 1 ? "s" : ""} today · ${earlierMin}m so far` : "Mark break start & end — the time is tracked."}
            </div>
          </>
        )}
      </div>
      {open ? (
        <button className="btn btn-primary" onClick={() => act(endBreakAction)} disabled={busy} style={{ whiteSpace: "nowrap" }}>
          {busy ? "…" : "End break"}
        </button>
      ) : (
        <button className="btn btn-ghost" onClick={() => act(() => startBreakAction())} disabled={busy} style={{ whiteSpace: "nowrap" }}>
          {busy ? "…" : "Start break"}
        </button>
      )}
    </div>
  );
}
