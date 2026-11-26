"use client";

import { useEffect, useRef, useState } from "react";
import Avatar, { avatarSrc } from "./Avatar";

type OnlineUser = { id: string; name: string; color: string; avatar: string; dept: string };

/**
 * "Who's online" — a live avatar cluster. Polls /api/presence while the tab is
 * visible, which also records this user's own heartbeat. Collapses to a dot +
 * count on mobile to keep the app-bar clean.
 */
export default function PresenceBar() {
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [meId, setMeId] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/presence", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        setOnline(Array.isArray(d.online) ? d.online : []);
        setMeId(d.meId || "");
      } catch { /* offline / transient — keep last known */ }
    };
    load();
    const t = setInterval(load, 60000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (online.length === 0) return null;

  // Me first, then everyone else — alphabetical for a stable order.
  const sorted = [...online].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name)));
  const shown = sorted.slice(0, 4);

  return (
    <div className="presence" ref={ref}>
      <button type="button" className="presence-btn" onClick={() => setOpen((v) => !v)} title={`${online.length} online now`} aria-label={`${online.length} people online`}>
        <span className="presence-stack">
          {shown.map((u) => (
            <Avatar key={u.id} name={u.name} color={u.color} src={avatarSrc({ id: u.id, avatar: u.avatar })} size="sm" className="presence-av" />
          ))}
        </span>
        <span className="presence-count"><span className="online-dot" />{online.length}</span>
      </button>
      {open && (
        <div className="presence-pop">
          <div className="presence-pop-head"><span className="online-dot" />Online now · {online.length}</div>
          <div className="presence-pop-list">
            {sorted.map((u) => (
              <div className="presence-row" key={u.id}>
                <Avatar name={u.name} color={u.color} src={avatarSrc({ id: u.id, avatar: u.avatar })} size="sm" />
                <div className="presence-row-meta">
                  <div className="n">{u.name}{u.id === meId ? " · You" : ""}</div>
                  {u.dept && <div className="d">{u.dept}</div>}
                </div>
                <span className="online-dot" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
