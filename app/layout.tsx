import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./modules.css";

export const metadata: Metadata = {
  title: "Tudo",
  description: "Everything your team does, in one place.",
  applicationName: "Tudo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Tudo", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
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
