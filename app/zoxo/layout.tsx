/**
 * Public pages for the Zoxo Chrome extension: landing, support and privacy.
 *
 * These sit outside the signed-in dashboard (see PUBLIC_PATHS in proxy.ts)
 * because the Chrome Web Store requires the privacy policy and support pages
 * to be reachable without an account.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Zoxo", template: "%s · Zoxo" },
  // The dashboard itself is noindex; these pages are genuinely public.
  robots: { index: true, follow: true },
};

export default function ZoxoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="zoxo-doc">
      <style>{CSS}</style>
      <nav className="zoxo-nav">
        <Link href="/zoxo" className="brand">
          <span className="mark">Z</span> Zoxo
        </Link>
        <div className="links">
          <Link href="/zoxo/support">Support</Link>
          <Link href="/zoxo/privacy">Privacy</Link>
        </div>
      </nav>
      {children}
      <footer className="zoxo-foot">
        <p>
          Zoxo is free — no ads, no accounts, no upsell. Built by Tushar Mali.{" "}
          <a href="mailto:tusharmali197@gmail.com">tusharmali197@gmail.com</a>
        </p>
      </footer>
    </div>
  );
}

const CSS = `
.zoxo-doc {
  max-width: 780px;
  margin: 0 auto;
  padding: 28px 22px 80px;
  color: #111827;
  background: #fff;
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.zoxo-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 18px; margin-bottom: 26px; border-bottom: 1px solid #e5e7eb;
}
.zoxo-nav .brand {
  display: inline-flex; align-items: center; gap: 9px;
  font-weight: 800; font-size: 18px; color: #111827; text-decoration: none; letter-spacing: -0.02em;
}
.zoxo-nav .mark {
  width: 28px; height: 28px; border-radius: 8px; color: #fff;
  background: linear-gradient(160deg, #6366f1, #06b6d4);
  display: inline-flex; align-items: center; justify-content: center; font-size: 16px;
}
.zoxo-nav .links { display: flex; gap: 18px; font-size: 14px; }
.zoxo-nav .links a { color: #4f46e5; text-decoration: none; }
.zoxo-nav .links a:hover { text-decoration: underline; }
.zoxo-doc h1 { font-size: 30px; margin: 0 0 8px; letter-spacing: -0.02em; }
.zoxo-doc h2 { font-size: 19px; margin: 34px 0 10px; letter-spacing: -0.01em; }
.zoxo-doc h3 { font-size: 15px; margin: 22px 0 6px; }
.zoxo-doc .lede { color: #6b7280; margin: 0 0 8px; }
.zoxo-doc p { margin: 0 0 12px; }
.zoxo-doc ul, .zoxo-doc ol { margin: 0 0 12px; padding-left: 22px; }
.zoxo-doc li { margin-bottom: 5px; }
.zoxo-doc table { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 14px; }
.zoxo-doc th { text-align: left; border-bottom: 2px solid #e5e7eb; padding: 8px 10px 8px 0; }
.zoxo-doc td { border-bottom: 1px solid #f1f3f7; padding: 8px 10px 8px 0; vertical-align: top; }
.zoxo-doc .mono, .zoxo-doc code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #374151;
}
.zoxo-doc code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; }
.zoxo-doc kbd {
  background: #f3f4f6; border: 1px solid #e5e7eb; border-bottom-width: 2px; border-radius: 5px;
  padding: 1px 6px; font: 600 12px/1.6 inherit;
}
.zoxo-doc a { color: #4f46e5; }
.zoxo-doc .card {
  border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 18px; margin: 0 0 14px;
  background: #fafbfe;
}
.zoxo-doc .card h3 { margin-top: 0; }
.zoxo-foot {
  margin-top: 44px; padding-top: 18px; border-top: 1px solid #e5e7eb;
  color: #6b7280; font-size: 14px;
}
.zoxo-foot p { margin: 0; }
@media (prefers-color-scheme: dark) {
  .zoxo-doc { background: #0b1020; color: #e6e9f2; }
  .zoxo-doc .lede, .zoxo-foot { color: #96a0b5; }
  .zoxo-nav { border-bottom-color: #263149; }
  .zoxo-nav .brand { color: #e6e9f2; }
  .zoxo-nav .links a, .zoxo-doc a { color: #a5b4fc; }
  .zoxo-doc th { border-bottom-color: #263149; }
  .zoxo-doc td { border-bottom-color: #1a2237; }
  .zoxo-doc .mono { color: #b6c0d4; }
  .zoxo-doc code, .zoxo-doc kbd { background: #1a2237; border-color: #263149; color: #cbd5e1; }
  .zoxo-doc .card { background: #131a2e; border-color: #263149; }
  .zoxo-foot { border-top-color: #263149; }
}
`;
