"use client";

import { useEffect, useState } from "react";
import { savePushSubscriptionAction } from "@/app/actions/notifications";
import { toast } from "./Toaster";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushToggle() {
  const [state, setState] = useState<"idle" | "on" | "unsupported" | "busy">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
    } else if (Notification.permission === "granted") {
      setState("on");
    }
  }, []);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast("Notifications were blocked");
        setState("idle");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        toast("Push isn't configured");
        setState("idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const r = await savePushSubscriptionAction({ subscription: JSON.parse(JSON.stringify(sub)) });
      if (r.ok) {
        toast(r.message || "Enabled");
        setState("on");
      } else {
        toast(r.error || "Error");
        setState("idle");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't enable");
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (state === "on") return <span className="tiny" style={{ color: "var(--good)", fontWeight: 600 }}>🔔 On</span>;
  return (
    <button className="btn btn-ghost" style={{ padding: "6px 11px", fontSize: 12 }} onClick={enable} disabled={state === "busy"} type="button">
      {state === "busy" ? "Enabling…" : "Enable notifications"}
    </button>
  );
}
