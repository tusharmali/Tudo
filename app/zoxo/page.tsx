/**
 * Landing page for the Zoxo Chrome extension — usable as the listing's
 * "Homepage URL", and the parent of the support and privacy pages.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zoxo — capture, record and annotate",
  description:
    "A Chrome extension for testers: full-page and area screenshots, screen recording, and a built-in image and video editor. Media never leaves your computer.",
};

const FEATURES: [string, string][] = [
  [
    "Screenshots",
    "Visible area, full page (scrolled and stitched), any region you drag, a single element, " +
      "a panel that scrolls on its own, or another app on your desktop.",
  ],
  [
    "Recording",
    "The current tab — it keeps going as you navigate — or a screen, a window, your camera as " +
      "a bubble in the corner, or just the microphone.",
  ],
  [
    "Image editor",
    "Crop, arrows, boxes, numbered steps, text and highlighter. Blur, pixelate or black out " +
      "anything that should not be in a bug report.",
  ],
  [
    "Video editor",
    "Trim, crop, change the speed, drop the audio, export WebM or MP4 — or turn a clip into an " +
      "animated GIF for the tracker.",
  ],
];

export default function ZoxoHomePage() {
  return (
    <main>
      <h1>Zoxo</h1>
      <p className="lede">
        Capture, record and annotate — built for testers, by Tushar Mali.
      </p>

      <div className="card">
        <h3>Nothing leaves your computer</h3>
        <p style={{ marginBottom: 0 }}>
          Screenshots and recordings are stored in your own browser, on your own machine. Zoxo
          has no upload path for media at all. Teams can optionally log a one-line record of
          which actions were used — text only, and any tester can switch it off. The details are
          in the <Link href="/zoxo/privacy">privacy policy</Link>.
        </p>
      </div>

      <h2>What it does</h2>
      {FEATURES.map(([title, body]) => (
        <div key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      ))}

      <h2>Help</h2>
      <p>
        The <Link href="/zoxo/support">support page</Link> covers the common questions —
        including why a &ldquo;full page&rdquo; capture sometimes needs the scrolling-panel mode,
        and when to choose MP4 over WebM. Anything else:{" "}
        <a href="mailto:tusharmali197@gmail.com">tusharmali197@gmail.com</a>.
      </p>
    </main>
  );
}
