"use client";

import { useEffect, useState } from "react";

/** Fire a toast from anywhere on the client. */
export function toast(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tudo:toast", { detail: message }));
  }
}

export default function Toaster() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function onToast(e: Event) {
      setMsg((e as CustomEvent<string>).detail);
      setShow(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShow(false), 2400);
    }
    window.addEventListener("tudo:toast", onToast);
    return () => {
      window.removeEventListener("tudo:toast", onToast);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`toast${show ? " show" : ""}`} role="status" aria-live="polite">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" />
      </svg>
      <span>{msg}</span>
    </div>
  );
}
