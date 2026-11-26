"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Smooth route transitions without React's experimental <ViewTransition>
 * (not exported by the React build this app ships). Keying the wrapper by
 * pathname remounts the page subtree on a real navigation, replaying the
 * `route-in` CSS animation — while a background `router.refresh()` keeps the
 * same pathname and so never re-animates (no flicker on the 120s poll).
 */
export default function RouteFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-fade">
      {children}
    </div>
  );
}
