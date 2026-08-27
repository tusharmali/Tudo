/**
 * Public privacy policy for the Zoxo Chrome extension.
 *
 * The Chrome Web Store requires a publicly reachable privacy policy URL for any
 * extension that declares data collection, so this page is deliberately outside
 * the signed-in area (see PUBLIC_PATHS in proxy.ts).
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What the Zoxo Chrome extension stores on your computer, and the small amount of metadata it can send to your own team's Google Sheet.",
};

const UPDATED = "27 August 2026";

const COLLECTED: [string, string][] = [
  ["Email address and name", "asha@company.com — identifies the tester in their own team's sheet"],
  ["Device id", "a random id generated when the extension is installed"],
  ["OS, browser and extension version", "Windows, Chrome 130, 1.0.3"],
  ["Event name", "capture.fullpage, record.stop, export.download …"],
  ["Capture mode", "fullpage, tab, screen+camera …"],
  ["Page address", "shop.example.com/checkout — never the query string or fragment"],
  ["Page title", "Checkout"],
  ["Size, dimensions, duration", "482113 bytes, 1440x5200, 42000 ms"],
  ["Timestamp", "2026-08-25T10:14:22.104Z"],
];

const PERMISSIONS: [string, string][] = [
  ["activeTab, tabs, host access", "Take the screenshot of the page you are on and read its size"],
  ["scripting", "Inject the area picker, the scrolling-panel picker and the recording controls on demand"],
  ["tabCapture", "Record the current tab"],
  ["offscreen", "Keep a tab recording alive while you navigate"],
  ["storage, unlimitedStorage", "Keep your settings and your captures on this machine"],
  ["downloads", "Save a capture to your Downloads folder when you ask"],
  ["identity, identity.email", "Read your Chrome profile email so you do not have to type it"],
  ["notifications", "Tell you when a long capture finishes or fails"],
  ["contextMenus, alarms, clipboardWrite", "Right-click menu, sending queued rows, Copy"],
];

export default function ZoxoPrivacyPage() {
  return (
    <main>
      <header>
        <h1>Zoxo — privacy policy</h1>
        <p className="lede">
          Zoxo is a screenshot and screen-recording extension for internal QA use, by Tushar
          Mali. Last updated {UPDATED}.
        </p>
      </header>

      <section>
        <h2>What stays on your computer</h2>
        <p>Everything you capture:</p>
        <ul>
          <li>screenshots (visible area, full page, selected area, element, desktop)</li>
          <li>screen, tab, camera and microphone recordings</li>
          <li>edited images, exported videos and GIFs</li>
          <li>thumbnails and in-progress recording chunks</li>
        </ul>
        <p>
          These are stored in the browser&rsquo;s own local database (IndexedDB) belonging to
          the extension. They are readable only by this extension, on this machine, in this
          Chrome profile. <strong>No code path in Zoxo uploads them anywhere.</strong> Files
          leave the browser only when you choose Download, at which point they go to your own
          Downloads folder.
        </p>
        <p>
          Deleting a capture in the library, or &ldquo;Delete everything&rdquo; in Settings,
          removes it permanently. Uninstalling the extension removes the whole database.
        </p>
      </section>

      <section>
        <h2>What can be sent to your team</h2>
        <p>
          If — and only if — an endpoint has been configured in Settings, Zoxo sends one small
          row per action to your own organisation&rsquo;s Google Sheet:
        </p>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            {COLLECTED.map(([field, example]) => (
              <tr key={field}>
                <td>{field}</td>
                <td className="mono">{example}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          That is the complete list. No pixels, no audio, no page content, no form values, no
          cookies, no browsing history.
        </p>
      </section>

      <section>
        <h2>Page addresses</h2>
        <p>
          Query strings and URL fragments are <strong>always removed</strong> before a row is
          created, because they routinely carry session tokens. Each tester can reduce this
          further in Settings:
        </p>
        <ul>
          <li>
            <strong>Host + path</strong> (default) — <span className="mono">shop.example.com/checkout</span>
          </li>
          <li>
            <strong>Origin + path</strong> — <span className="mono">https://shop.example.com/checkout</span>
          </li>
          <li>
            <strong>Host only</strong> — <span className="mono">shop.example.com</span>
          </li>
          <li>
            <strong>Off</strong> — no address recorded at all
          </li>
        </ul>
      </section>

      <section>
        <h2>Turning it off</h2>
        <p>
          Settings → Team activity log → untick <em>Send activity rows to the team sheet</em>.
          Every capture and recording feature keeps working exactly as before.
        </p>
      </section>

      <section>
        <h2>Permissions, and why each is needed</h2>
        <table>
          <thead>
            <tr>
              <th>Permission</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map(([permission, why]) => (
              <tr key={permission}>
                <td className="mono">{permission}</td>
                <td>{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Zoxo contains no analytics SDK, no advertising code and no third-party scripts, and
          makes network requests to exactly one place: the endpoint your own administrator
          configured.
        </p>
      </section>

      <section>
        <h2>Third parties, selling and sharing</h2>
        <p>
          None, never, and no. Activity rows go to a Google Sheet owned by your organisation,
          via your organisation&rsquo;s own service account. Data is not sold, not used for
          advertising, not used to assess creditworthiness, and not shared with anyone else.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Zoxo is a workplace tool and is not directed at children under 13.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions, or a request to remove your rows from a sheet:{" "}
          <a href="mailto:tusharmali197@gmail.com">tusharmali197@gmail.com</a>.
        </p>
      </section>

    </main>
  );
}
