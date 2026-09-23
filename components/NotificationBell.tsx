"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/app/actions/notifications";
import { toast } from "./Toaster";
import PushToggle from "./PushToggle";

type Item = { id: string; title: string; body: string; url: string; createdAt: string };

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const prevUnread = useRef(0);
  const firstLoad = useRef(true);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: Item[]; unread: number };
      const list = d.items || [];
      const count = d.unread || 0;
      setItems(list);
      setUnread(count);
      if (!firstLoad.current && count > prevUnread.current && !openRef.current && list[0]) {
        toast(`📣 ${list[0].title}`);
      }
      firstLoad.current = false;
      prevUnread.current = count;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    const onRefresh = () => load();
    window.addEventListener("tudo:notify-refresh", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("tudo:notify-refresh", onRefresh);
    };
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function toggle() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread > 0) {
      setUnread(0);
      prevUnread.current = 0;
      await markNotificationsReadAction();
    }
  }

  function openItem(n: Item) {
    setOpen(false);
    router.push(n.url || "/dashboard");
  }

  return (
    <div className="bell-wrap" ref={ref}>
      <button className="icon-btn" onClick={toggle} title="Notifications" type="button">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-menu">
          <div className="bh" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Notifications</span>
            <PushToggle />
          </div>
          <div className="bl">
            {items.length === 0 && (
              <div className="bell-item">
                <div className="bb">No notifications yet.</div>
              </div>
            )}
            {items.map((n) => (
              <button className="bell-item bell-item-btn" key={n.id} type="button" onClick={() => openItem(n)}>
                <div className="bt">{n.title}</div>
                {n.body && <div className="bb">{n.body}</div>}
                <div className="bm">{timeAgo(n.createdAt)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
