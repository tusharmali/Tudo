"use client";

import { useEffect, useState } from "react";
import { savePushSubscriptionAction } from "@/app/actions/notifications";
import { toast } from "./Toaster";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** App-wide nudge: install the PWA + enable push notifications. Shows only what's
 *  actually missing, dismissible per browser session. */
export default function PwaPrompts() {
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [notifNeed, setNotifNeed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let sessionDismissed = false;
    try {
      sessionDismissed = sessionStorage.getItem("tudo-pwa-dismiss") === "1";
    } catch {
      /* ignore */
    }
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const canNotify = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    const needNotif = canNotify && Notification.permission === "default";
    const needIOSInstall = !standalone && isIOS;
    setNotifNeed(needNotif);
    setIosHint(needIOSInstall);
    if (!sessionDismissed && (needNotif || needIOSInstall)) setHidden(false);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
      if (!sessionDismissed && !standalone) setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canInstall = !!installEvt || iosHint;
  if (hidden || (!canInstall && !notifNeed)) return null;

  async function install() {
    if (installEvt) {
      setBusy(true);
      await installEvt.prompt();
      await installEvt.userChoice.catch(() => {});
      setInstallEvt(null);
      setBusy(false);
    } else if (iosHint) {
      toast("Tap the Share icon, then 'Add to Home Screen'");
    }
  }

  async function enableNotif() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifNeed(false);
        toast(perm === "denied" ? "Notifications blocked in browser settings" : "Maybe later");
        setBusy(false);
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (key) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });
        await savePushSubscriptionAction({ subscription: JSON.parse(JSON.stringify(sub)) });
      }
      toast("Notifications enabled 🔔");
      setNotifNeed(false);
    } catch {
      /* ignore */
    }
    setBusy(false);
  }

  function dismiss() {
    try {
      sessionStorage.setItem("tudo-pwa-dismiss", "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <div className="pwa-banner">
      <div className="pwa-ic">{canInstall ? "📲" : "🔔"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Get the full Tudo experience</div>
        <div className="tiny muted">
          {canInstall && notifNeed
            ? "Install the app and turn on alerts for check-ins, updates & broadcasts."
            : canInstall
              ? "Install Tudo on your device for one-tap access."
              : "Turn on notifications for check-ins, updates & broadcasts."}
        </div>
      </div>
      <div className="row" style={{ gap: 8, flex: "none" }}>
        {canInstall && (
          <button className="btn btn-primary" style={{ padding: "7px 12px", fontSize: 12.5, whiteSpace: "nowrap" }} onClick={install} disabled={busy}>
            {iosHint && !installEvt ? "How to install" : "Install"}
          </button>
        )}
        {notifNeed && (
          <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 12.5, whiteSpace: "nowrap" }} onClick={enableNotif} disabled={busy}>
            Enable alerts
          </button>
        )}
        <button className="icon-btn" style={{ width: 30, height: 30, flex: "none" }} onClick={dismiss} title="Dismiss" type="button">
          ✕
        </button>
      </div>
    </div>
  );
}
