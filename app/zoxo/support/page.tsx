/**
 * Support page for the Zoxo Chrome extension — the "Support URL" on the
 * Chrome Web Store listing, which must be a reachable web page.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Help with Zoxo — the screenshot, screen recording and annotation extension. Common questions, keyboard shortcuts and how to get in touch.",
};

const SHORTCUTS: [string, string][] = [
  ["Alt + Shift + V", "Capture the visible area"],
  ["Alt + Shift + F", "Capture the full page"],
  ["Alt + Shift + A", "Capture a selected area"],
  ["Alt + Shift + R", "Start or stop recording this tab"],
];

export default function ZoxoSupportPage() {
  return (
    <main>
      <h1>Zoxo support</h1>
      <p className="lede">
        Screenshots, screen recording and annotation for testers. Everything you capture stays
        on your own computer.
      </p>

      <div className="card">
        <h3>Get in touch</h3>
        <p style={{ marginBottom: 0 }}>
          Email <a href="mailto:tusharmali197@gmail.com">tusharmali197@gmail.com</a> with what
          you were doing, the page you were on, and what happened instead. A screenshot helps —
          you have a good tool for that.
        </p>
      </div>

      <h2>Common questions</h2>

      <h3>&ldquo;Full page&rdquo; only captured one screen</h3>
      <p>
        Some apps — Gmail, Slack, chat logs, admin panels — keep the page itself fixed and
        scroll an inner panel instead. Zoxo detects that and captures the panel automatically.
        If it picks the wrong one, use <b>Scrolling panel</b> from the Zoxo popup, hover the
        area that scrolls and click it. Press <kbd>↑</kbd> / <kbd>↓</kbd> while hovering to
        step out to a wider container.
      </p>

      <h3>Nothing happens on some pages</h3>
      <p>
        Chrome does not allow extensions to run on <code>chrome://</code> pages, the Chrome Web
        Store, or Zoxo&rsquo;s own tabs. Switch to an ordinary http(s) page. Zoxo will tell you
        when this is the reason.
      </p>

      <h3>Should I use WebM or MP4?</h3>
      <p>
        <b>WebM</b> (the default) gives the smallest files and plays anywhere Chromium does.
        <b> MP4</b> is H.264, which Jira, Slack, QuickTime and most video editors prefer. On
        Windows and macOS the MP4 audio track is AAC; Linux builds of Chrome have no AAC
        encoder, so MP4 there carries Opus audio — fine in Chrome, VLC and ffmpeg-based tools,
        but a few older editors will read only the video track. Settings shows the exact format
        your machine will produce.
      </p>

      <h3>Where are my captures kept?</h3>
      <p>
        In this browser&rsquo;s own local database, on this computer. Open the Zoxo library to
        search, rename, download or delete them. Nothing is uploaded — see the{" "}
        <a href="/zoxo/privacy">privacy policy</a>. Because they are local, clearing site data
        for the extension or uninstalling it removes them permanently.
      </p>

      <h3>Chrome crashed while I was recording</h3>
      <p>
        Recordings are written to disk in short chunks as they happen, so an interrupted take is
        usually recoverable. Open the library — if anything can be salvaged, a banner offers to
        rebuild it.
      </p>

      <h3>Recording has no sound</h3>
      <p>
        Tab audio and the microphone are separate switches. Turn on <b>Mic</b> in the popup
        before you start, and tick <b>system audio</b> in Chrome&rsquo;s own sharing dialog when
        recording a screen — Chrome only offers that for a tab or a whole screen, not a single
        window.
      </p>

      <h3>My team asked me to set an endpoint</h3>
      <p>
        Open Settings and paste the endpoint URL and ingest key your admin gave you. That log
        records only which actions you used and when — never images, video or page content — and
        you can switch it off at any time without losing a single feature.
      </p>

      <h2>Keyboard shortcuts</h2>
      <table>
        <thead>
          <tr>
            <th>Keys</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map(([keys, action]) => (
            <tr key={keys}>
              <td className="mono">{keys}</td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Change any of them at <code>chrome://extensions/shortcuts</code> — paste that into the
        address bar, as extensions are not allowed to open it for you.
      </p>

      <h2>Reporting a bug</h2>
      <p>Include as much of this as you can:</p>
      <ul>
        <li>What you clicked, and what you expected</li>
        <li>The site (or that it is internal — no need to share anything confidential)</li>
        <li>Your Chrome version, from <code>chrome://version</code></li>
        <li>Your Zoxo version, shown at the bottom of Settings</li>
      </ul>
    </main>
  );
}
