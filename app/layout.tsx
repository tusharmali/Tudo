import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./modules.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tudo.vercel.app";
const description =
  "Tudo is your team's internal workspace — GPS attendance, daily updates & day plans, chat, concerns, releases and announcements, all in one fast, private place.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tudo — Everything your team does, in one place",
    template: "%s · Tudo",
  },
  description,
  applicationName: "Tudo",
  keywords: ["team dashboard", "internal tool", "attendance", "daily standup", "day plan", "team management", "HR"],
  authors: [{ name: "Tudo" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tudo", statusBarStyle: "default" },
  // Internal, auth-gated tool — keep it out of search engines.
  // Flip to `{ index: true, follow: true }` if you ever want it publicly discoverable.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Tudo",
    title: "Tudo — Everything your team does, in one place",
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tudo — Everything your team does, in one place",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#7178DD",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Set the theme before paint to avoid a light/dark flash on first load.
const themeInit = `(function(){try{var t=localStorage.getItem('tudo-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
