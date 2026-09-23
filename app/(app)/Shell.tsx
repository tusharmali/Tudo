"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import NotificationBell from "@/components/NotificationBell";
import { isManager, roleLabel } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

const svg = (d: ReactNode) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {d}
  </svg>
);

const icons = {
  home: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5 9v11h14V9" />),
  updates: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />),
  attendance: svg(<><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-5.2-7-10a7 7 0 0 1 14 0c0 4.8-7 10-7 10Z" /><circle cx="12" cy="11" r="2.5" /></>),
  concerns: svg(<><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 1 0 4.5 18.9L21 22l-1.1-4.4A10 10 0 0 0 12 2Z" /><path strokeLinecap="round" d="M12 8v4m0 3h.01" /></>),
  chat: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-11.3 7.3L3 21l1.7-6.7A8 8 0 1 1 21 12Z" />),
  releases: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 16.5 3 21l4.5-1.5M14 5s5 1 5 6-6 8-6 8l-3-3s2-9 4-11ZM9 15l-3-3M15 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />),
  fun: svg(<path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.9 4.6L19 9l-4.6 1.9L12 15l-1.9-4.1L5 9l4.6-1.4L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />),
  kudos: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M6 4h12v4a6 6 0 0 1-12 0V4ZM6 6H3v1a3 3 0 0 0 3 3m12-4h3v1a3 3 0 0 1-3 3" />),
  broadcast: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" />),
  logout: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0 4-4m-4 4 4 4M9 5V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1" />),
  sun: svg(<><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></>),
  moon: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />),
  more: svg(<><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>),
  account: svg(<><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></>),
  people: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 20v-2a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8" />),
  reports: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 20V4m0 16h16M8 16v-4m4 4V8m4 8v-6" />),
  refresh: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 0 0 6 5.3L4 8M4 15a8 8 0 0 0 14 3.7l2-2.7" />),
};

type NavItem = { href: string; label: string; icon: ReactNode; badge?: string };
type NavSection = { section: string | null; adminOnly?: boolean; items: NavItem[] };

const NAV: NavSection[] = [
  { section: null, items: [{ href: "/dashboard", label: "Home", icon: icons.home }] },
  {
    section: "Daily",
    items: [
      { href: "/updates", label: "Updates & Plan", icon: icons.updates },
      { href: "/attendance", label: "Attendance", icon: icons.attendance },
    ],
  },
  {
    section: "Connect",
    items: [
      { href: "/concerns", label: "Concerns", icon: icons.concerns },
      { href: "/chat", label: "Chat", icon: icons.chat },
      { href: "/releases", label: "Releases", icon: icons.releases },
      { href: "/kudos", label: "Kudos", icon: icons.kudos },
      { href: "/fun", label: "Fun Zone", icon: icons.fun },
    ],
  },
  {
    section: "Manage",
    adminOnly: true,
    items: [
      { href: "/people", label: "People", icon: icons.people },
      { href: "/reports", label: "Reports", icon: icons.reports },
      { href: "/broadcast", label: "Broadcast", icon: icons.broadcast },
    ],
  },
];

const MOBILE: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: icons.home },
  { href: "/updates", label: "Updates", icon: icons.updates },
  { href: "/attendance", label: "Attend", icon: icons.attendance },
  { href: "/chat", label: "Chat", icon: icons.chat },
];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function greetWord(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [greeting, setGreeting] = useState("Welcome back");
  const [dateStr, setDateStr] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Keep every screen live: soft-refresh server data every 30s (paused when the
  // tab is hidden). Client state — inputs, open menus — is preserved.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [router]);

  function refreshNow() {
    setSyncing(true);
    router.refresh();
    setTimeout(() => setSyncing(false), 600);
  }

  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(t);
    setGreeting(greetWord());
    setDateStr(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }));
  }, []);

  // The main panel is the scroll container — reset it to the top on navigation,
  // and always close the mobile "More" sheet when the route changes.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setMoreOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const nextT = theme === "dark" ? "light" : "dark";
    setTheme(nextT);
    document.documentElement.setAttribute("data-theme", nextT);
    try {
      localStorage.setItem("tudo-theme", nextT);
    } catch {
      /* ignore */
    }
  }

  const first = user.name.split(" ")[0] || user.name;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const sections = NAV.filter((s) => !s.adminOnly || isManager(user.role));
  const roleText = user.role === "employee" ? user.dept || "Employee" : roleLabel(user.role);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-mark">T</div>
          <div className="brand-name">Tudo</div>
        </div>

        {sections.map((sec, i) => (
          <div key={i}>
            {sec.section && <div className="nav-label">{sec.section}</div>}
            {sec.items.map((item) => (
              <Link key={item.href} href={item.href} className={`nav-item${isActive(item.href) ? " active" : ""}`}>
                {item.icon}
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </Link>
            ))}
          </div>
        ))}

        <div className="side-user">
          <Link href="/account" className="row" style={{ gap: 10, minWidth: 0, flex: 1, color: "inherit" }} title="Account & password">
            <div className="avatar" style={{ background: user.color }}>
              {initials(user.name)}
            </div>
            <div className="meta">
              <div className="n">{user.name}</div>
              <div className="r">{roleText}</div>
            </div>
          </Link>
          <form action={logout}>
            <button className="icon-btn" style={{ width: 32, height: 32 }} title="Sign out" type="submit">
              {icons.logout}
            </button>
          </form>
        </div>
      </aside>

      <div className="main" ref={mainRef}>
        <header className="topbar">
          <div>
            <h2>
              {greeting}, {first} 👋
            </h2>
            <div className="sub">{dateStr || roleText}</div>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={refreshNow} title="Refresh now" type="button" style={syncing ? { animation: "spin .6s linear" } : undefined}>
              {icons.refresh}
            </button>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" type="button" suppressHydrationWarning>
              {theme === "dark" ? icons.sun : icons.moon}
            </button>
            <NotificationBell />
            <Link href="/account" className="avatar" style={{ background: user.color, textDecoration: "none" }} title="Account & password">
              {initials(user.name)}
            </Link>
          </div>
        </header>

        <main className="canvas">{children}</main>
      </div>

      <nav className="mobilenav">
        {MOBILE.map((item) => (
          <Link key={item.href} href={item.href} className={`mnav${isActive(item.href) ? " active" : ""}`}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" className={`mnav${moreOpen ? " active" : ""}`} onClick={() => setMoreOpen(true)}>
          {icons.more}
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Menu">
            <div className="sheet-grip" />
            {sections.map((sec, i) => (
              <div key={i}>
                {sec.section && <div className="nav-label">{sec.section}</div>}
                {sec.items.map((item) => (
                  <Link key={item.href} href={item.href} className={`nav-item${isActive(item.href) ? " active" : ""}`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
            <div className="sheet-foot">
              <Link href="/account" className="nav-item">
                {icons.account}
                <span>Account &amp; password</span>
              </Link>
              <button type="button" className="nav-item" onClick={toggleTheme}>
                {theme === "dark" ? icons.sun : icons.moon}
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
              <form action={logout}>
                <button className="nav-item" type="submit" style={{ width: "100%" }}>
                  {icons.logout}
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
