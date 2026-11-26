"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import NotificationBell from "@/components/NotificationBell";
import Appearance from "@/components/Appearance";
import RouteFade from "@/components/RouteFade";
import CommandPalette, { type CmdItem } from "@/components/CommandPalette";
import PwaPrompts from "@/components/PwaPrompts";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { isManager, canPlan, roleLabel } from "@/lib/roles";
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
  shoots: svg(<><rect x="3" y="7" width="18" height="12" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 7l1.5-2h5L16 7" /><circle cx="12" cy="13" r="3" /></>),
  milestones: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4m0 0 8 2-1.5 3L14 12l-9-2" />),
  logs: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M9 5h9M9 12h9M9 19h9M4.5 5h.01M4.5 12h.01M4.5 19h.01" />),
  refresh: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9A8 8 0 0 0 6 5.3L4 8M4 15a8 8 0 0 0 14 3.7l2-2.7" />),
  myspace: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1ZM9 9h6M9 12h4" />),
  calendar: svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18M8 3v4M16 3v4" /></>),
  wallet: svg(<><rect x="3" y="6" width="18" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M16 14h2" /></>),
  assets: svg(<><rect x="3" y="4" width="18" height="12" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8M12 16v4" /></>),
  coffee: svg(<path strokeLinecap="round" strokeLinejoin="round" d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2.5a2.5 2.5 0 0 1 0 5H17M7 3v2M11 3v2M15 3v2" />),
  board: svg(<><rect x="3" y="4" width="5" height="16" rx="1.4" /><rect x="10" y="4" width="5" height="11" rx="1.4" /><rect x="17" y="4" width="4" height="7" rx="1.4" /></>),
  search: svg(<><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m20 20-3.5-3.5" /></>),
};

type NavItem = { href: string; label: string; icon: ReactNode; badge?: string; depts?: string[]; ownerOnly?: boolean; plannerOnly?: boolean };
type NavSection = { section: string | null; adminOnly?: boolean; items: NavItem[] };

const NAV: NavSection[] = [
  { section: null, items: [{ href: "/dashboard", label: "Home", icon: icons.home }] },
  {
    section: "Daily",
    items: [
      { href: "/updates", label: "Updates & Plan", icon: icons.updates },
      { href: "/board", label: "Work Board", icon: icons.board },
      { href: "/attendance", label: "Attendance", icon: icons.attendance },
      { href: "/my", label: "My Space", icon: icons.myspace },
    ],
  },
  {
    section: "Connect",
    items: [
      { href: "/concerns", label: "Concerns", icon: icons.concerns },
      { href: "/chat", label: "Chat", icon: icons.chat },
      { href: "/releases", label: "Releases", icon: icons.releases, depts: ["Tech"] },
      { href: "/shoots", label: "Shoots & Clients", icon: icons.shoots, depts: ["Digi"] },
      { href: "/milestones", label: "Milestones", icon: icons.milestones, depts: ["Support"] },
      { href: "/kudos", label: "Kudos", icon: icons.kudos },
      { href: "/calendar", label: "Calendar", icon: icons.calendar },
      { href: "/team", label: "Team Log", icon: icons.coffee, plannerOnly: true },
      { href: "/fun", label: "Fun Zone", icon: icons.fun },
    ],
  },
  {
    section: "Manage",
    adminOnly: true,
    items: [
      { href: "/people", label: "People", icon: icons.people },
      { href: "/expenses", label: "Expenses", icon: icons.wallet },
      { href: "/assets", label: "Assets", icon: icons.assets },
      { href: "/reports", label: "Reports", icon: icons.reports },
      { href: "/logs", label: "Activity Log", icon: icons.logs },
      { href: "/broadcast", label: "Broadcast", icon: icons.broadcast },
      { href: "/data", label: "Storage", icon: icons.reports, ownerOnly: true },
    ],
  },
];

const MOBILE: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: icons.home },
  { href: "/updates", label: "Updates", icon: icons.updates },
  { href: "/attendance", label: "Attend", icon: icons.attendance },
  { href: "/chat", label: "Chat", icon: icons.chat },
];


function greetWord(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Shell({ user, isOwner = false, children }: { user: SessionUser; isOwner?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [greeting, setGreeting] = useState("Welcome back");
  const [dateStr, setDateStr] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  // The route we're navigating TO — set the instant a nav link is tapped so the
  // target lights up and a progress bar appears before the server responds.
  const [navTo, setNavTo] = useState<string | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Keep every screen live, but cheaply: soft-refresh server data every 2 min and
  // only when the tab is actually in front (visible AND focused). Background tabs
  // used to poll 24/7 and exhausted the Vercel free quota. The ⟳ button is there
  // for an instant refresh. Chat is excluded — it runs its own message poll.
  useEffect(() => {
    if (pathname === "/chat") return;
    const tick = () => { if (document.visibilityState === "visible" && document.hasFocus()) router.refresh(); };
    const t = setInterval(tick, 120000);
    // Refresh once when the tab comes back to the foreground so it's fresh on return.
    const onShow = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [router, pathname]);

  function refreshNow() {
    setSyncing(true);
    router.refresh();
    setTimeout(() => setSyncing(false), 600);
  }

  useEffect(() => {
    setGreeting(greetWord());
    setDateStr(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }));
    setMounted(true);
    try { setCollapsed(localStorage.getItem("tudo-collapsed") === "1"); } catch { /* ignore */ }
    try { const f = JSON.parse(localStorage.getItem("tudo-favs") || "[]"); if (Array.isArray(f)) setFavs(f); } catch { /* ignore */ }
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => { const n = !c; try { localStorage.setItem("tudo-collapsed", n ? "1" : "0"); } catch { /* ignore */ } return n; });
  }
  function toggleFav(href: string) {
    setFavs((prev) => { const n = prev.includes(href) ? prev.filter((x) => x !== href) : [...prev, href]; try { localStorage.setItem("tudo-favs", JSON.stringify(n)); } catch { /* ignore */ } return n; });
  }

  // The main panel is the scroll container — reset it to the top on navigation,
  // close the mobile "More" sheet, and clear the pending-nav indicator once the
  // route has actually committed.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    setMoreOpen(false);
    setNavTo(null);
  }, [pathname]);

  // Safety net: if a navigation is cancelled (e.g. same-page, blocked), don't
  // leave the progress bar stuck on.
  useEffect(() => {
    if (!navTo) return;
    const t = setTimeout(() => setNavTo(null), 6000);
    return () => clearTimeout(t);
  }, [navTo]);

  // ⌘K / Ctrl-K opens the quick switcher from anywhere; it toggles so the same
  // keystroke closes it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const first = user.name.split(" ")[0] || user.name;
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // Optimistic: treat the just-clicked destination as active too, so feedback
  // is instant even while the server renders the new page.
  const navActive = (href: string) => isActive(href) || navTo === href;
  const startNav = (href: string) => { if (href !== pathname) setNavTo(href); };
  // Managers see everything; employees see shared items + their department's items.
  const canSeeItem = (item: NavItem) =>
    (!item.ownerOnly || isOwner) &&
    (!item.plannerOnly || canPlan(user)) &&
    (isManager(user.role) || !item.depts || item.depts.includes(user.dept));
  const sections = NAV
    .filter((s) => !s.adminOnly || isManager(user.role))
    .map((s) => ({ ...s, items: s.items.filter(canSeeItem) }))
    .filter((s) => s.items.length > 0);
  const roleText = isManager(user.role)
    ? roleLabel(user.role)
    : user.role === "deptadmin"
      ? `${roleLabel(user.role)} · ${user.dept}`
      : user.dept || "Employee";
  const meSrc = avatarSrc({ id: user.sub, avatar: user.avatar });
  const allItems = sections.flatMap((s) => s.items);
  const favItems = allItems.filter((i) => favs.includes(i.href));

  // Mobile app-bar shows the CURRENT screen's title (like a native app), not a
  // generic greeting on every page. Home keeps the warm greeting.
  const onHome = pathname === "/dashboard";
  const screenTitle = (() => {
    const map: Record<string, string> = { "/account": "Account", "/notifications": "Notifications" };
    for (const it of allItems) map[it.href] = it.label;
    for (const k of Object.keys(map).sort((a, b) => b.length - a.length)) {
      if (pathname === k || pathname.startsWith(k + "/")) return map[k];
    }
    return "Tudo";
  })();
  const mobileTitle = onHome ? `${greeting}, ${first}` : screenTitle;

  // Everything the ⌘K quick switcher can jump to — the nav items this person can
  // reach, plus their personal pages.
  const paletteItems: CmdItem[] = [
    ...sections.flatMap((s) => s.items.map((it) => ({ href: it.href, label: it.label, icon: it.icon, section: s.section || "" }))),
    { href: "/account", label: "Account & password", icon: icons.account, section: "You" },
    { href: "/notifications", label: "Notifications", icon: icons.broadcast, section: "You" },
  ];
  const goTo = (href: string) => { startNav(href); setCmdOpen(false); router.push(href); };

  const renderItem = (item: NavItem) => (
    <div className="nav-row" key={item.href}>
      <Link href={item.href} onClick={() => startNav(item.href)} className={`nav-item${navActive(item.href) ? " active" : ""}`} title={item.label}>
        {item.icon}
        <span>{item.label}</span>
        {item.badge && <span className="nav-badge">{item.badge}</span>}
      </Link>
      <button type="button" className={`nav-star${favs.includes(item.href) ? " on" : ""}`} title={favs.includes(item.href) ? "Unpin from favorites" : "Pin to favorites"} onClick={() => toggleFav(item.href)}>
        {favs.includes(item.href) ? "★" : "☆"}
      </button>
    </div>
  );

  return (
    <div className={`app${collapsed ? " collapsed" : ""}`}>
      <div className={`nav-progress${navTo ? " on" : ""}`} aria-hidden />
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-mark">T</div>
          <div className="brand-name">Tudo</div>
          <button type="button" className="side-collapse" onClick={toggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <button type="button" className="side-search" onClick={() => setCmdOpen(true)} title="Search — ⌘K">
          {icons.search}
          <span>Search…</span>
          <kbd className="side-kbd">⌘K</kbd>
        </button>

        <div className="side-nav">
          {mounted && favItems.length > 0 && (
            <div>
              <div className="nav-label">Favorites</div>
              {favItems.map(renderItem)}
            </div>
          )}
          {sections.map((sec, i) => (
            <div key={i}>
              {sec.section && <div className="nav-label">{sec.section}</div>}
              {sec.items.map(renderItem)}
            </div>
          ))}
        </div>

        <div className="side-user">
          <Link href="/account" className="row" style={{ gap: 10, minWidth: 0, flex: 1, color: "inherit" }} title="Account & password">
            <Avatar name={user.name} color={user.color} src={meSrc} />
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
          <div className="tb-desktop">
            <h2>
              {greeting}, {first} 👋
            </h2>
            <div className="sub">{dateStr || roleText}</div>
          </div>
          <div className="tb-mobile">
            <div className="tb-title">{mobileTitle}{onHome ? " 👋" : ""}</div>
            {onHome && dateStr && <div className="tb-sub">{dateStr}</div>}
          </div>
          <div className="top-actions">
            <button className="icon-btn mobile-search-btn" onClick={() => setCmdOpen(true)} title="Search" aria-label="Search" type="button">
              {icons.search}
            </button>
            <button className="icon-btn tb-appearance" onClick={refreshNow} title="Refresh now" type="button" style={syncing ? { animation: "spin .6s linear" } : undefined}>
              {icons.refresh}
            </button>
            <span className="tb-appearance"><Appearance /></span>
            <NotificationBell />
            <Link href="/account" style={{ textDecoration: "none" }} title="Account & password">
              <Avatar name={user.name} color={user.color} src={meSrc} />
            </Link>
          </div>
        </header>

        <main className="canvas"><RouteFade>{children}</RouteFade></main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={paletteItems} onNavigate={goTo} />

      <PwaPrompts />

      <nav className="mobilenav">
        {MOBILE.map((item) => (
          <Link key={item.href} href={item.href} onClick={() => startNav(item.href)} className={`mnav${navActive(item.href) ? " active" : ""}`}>
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
                  <Link key={item.href} href={item.href} onClick={() => startNav(item.href)} className={`nav-item${navActive(item.href) ? " active" : ""}`}>
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
              <Appearance variant="sheet" />
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
