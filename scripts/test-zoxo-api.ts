/**
 * End-to-end check of the Zoxo ingest endpoints against the real sheet.
 *   npx tsx scripts/test-zoxo-api.ts
 *
 * Calls the route handlers directly (no dev server needed), verifies the rows
 * landed in the "Zoxo Backend" spreadsheet, then deletes the rows it wrote so
 * the sheet is left exactly as it was found.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { JWT } from "google-auth-library";
import { POST as registerPOST, OPTIONS as registerOPTIONS } from "../app/api/zoxo/register/route";
import { POST as eventsPOST } from "../app/api/zoxo/events/route";
import { GET as healthGET } from "../app/api/zoxo/health/route";
import { readTab, invalidate, checkIngestKey } from "../lib/zoxo";
import { getServiceAccount } from "../lib/env";
import type { NextRequest } from "next/server";

const KEY = (process.env.ZOXO_INGEST_KEY || "").trim();
const SHEET = (process.env.ZOXO_SHEET_ID || "").trim();
const TEST_EMAIL = "zoxo.selftest@example.com";
const TEST_DEVICE = "dev_selftest_0001";

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL ${name} ${extra}`);
  }
};

function req(body: unknown, key = KEY): NextRequest {
  return new Request("http://localhost/api/zoxo/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Zoxo-Key": key },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const envelope = {
  deviceId: TEST_DEVICE,
  email: TEST_EMAIL,
  name: "Zoxo Self Test",
  os: "Linux",
  browser: "Chrome 130",
  screen: "1920x1080",
  tz: "Asia/Kolkata",
  locale: "en-GB",
  extVersion: "1.0.0",
};

async function main() {
  console.log("zoxo ingest endpoints\n");

  /* health ------------------------------------------------------------- */
  const health = await healthGET();
  const healthBody = await health.json();
  check("GET /health returns 200", health.status === 200, JSON.stringify(healthBody));
  check("health reports the sheet is configured", healthBody.sheetConfigured === true);
  check("health reports the ingest key is set", healthBody.ingestKeySet === true);

  /* CORS --------------------------------------------------------------- */
  const options = await registerOPTIONS();
  check("OPTIONS preflight returns 204", options.status === 204);
  check(
    "preflight allows the X-Zoxo-Key header",
    (options.headers.get("Access-Control-Allow-Headers") || "").includes("X-Zoxo-Key"),
  );

  /* auth --------------------------------------------------------------- */
  const badKey = await registerPOST(req({ ...envelope }, "not-the-key"));
  check("a wrong ingest key is rejected with 401", badKey.status === 401);

  // An unset key must never mean "open" on a deployed site.
  // NODE_ENV is typed read-only; this test deliberately toggles it.
  const env = process.env as Record<string, string | undefined>;
  const savedKey = env.ZOXO_INGEST_KEY;
  const savedEnv = env.NODE_ENV;
  delete env.ZOXO_INGEST_KEY;
  env.NODE_ENV = "production";
  const openInProd = await registerPOST(req({ ...envelope }, ""));
  check("an unset ingest key is refused in production", openInProd.status === 401);
  env.NODE_ENV = "development";
  check("an unset ingest key still works in development", checkIngestKey(""));
  env.NODE_ENV = savedEnv;
  env.ZOXO_INGEST_KEY = savedKey;

  /* register ----------------------------------------------------------- */
  const reg = await registerPOST(req({ ...envelope, reason: "install" }));
  const regBody = await reg.json();
  check("POST /register returns 200", reg.status === 200, JSON.stringify(regBody));
  check("register returns a tester id", !!regBody.testerId, JSON.stringify(regBody));
  check("register returns the remote config", typeof regBody.config === "object");
  check(
    "config carries the seeded defaults",
    regBody.config?.["telemetry.enabled"] === "true",
    JSON.stringify(regBody.config),
  );

  /* events ------------------------------------------------------------- */
  const now = new Date().toISOString();
  const events = [
    {
      id: "ev_selftest_1",
      ts: now,
      type: "capture.fullpage",
      mode: "fullpage",
      page: "shop.example.com/checkout",
      pageTitle: "Checkout",
      sizeBytes: 482113,
      width: 1440,
      height: 5200,
      format: "image/png",
      meta: '{"truncated":false}',
      ...envelope,
    },
    {
      id: "ev_selftest_2",
      ts: now,
      type: "record.stop",
      mode: "tab",
      page: "shop.example.com/cart",
      durationMs: 42000,
      sizeBytes: 8123456,
      format: "video/webm",
      ...envelope,
    },
    {
      id: "ev_selftest_3",
      ts: now,
      type: "totally-made-up",
      mode: "x",
      ...envelope,
    },
  ];
  const evRes = await eventsPOST(req({ events }));
  const evBody = await evRes.json();
  check("POST /events returns 200", evRes.status === 200, JSON.stringify(evBody));
  check("all three events accepted", evBody.accepted === 3, JSON.stringify(evBody));

  const tooMany = await eventsPOST(req({ events: new Array(201).fill(events[0]) }));
  check("more than 200 events in one call is refused", tooMany.status === 413);

  const empty = await eventsPOST(req({ events: [] }));
  check("an empty batch is accepted as a no-op", empty.status === 200);

  /* verify what landed -------------------------------------------------- */
  invalidate();
  const testers = await readTab("Testers", true);
  const mine = testers.filter((r) => r.email === TEST_EMAIL);
  check("exactly one Testers row for this device", mine.length === 1, `${mine.length} rows`);
  check("tester row records the browser", mine[0]?.browser === "Chrome 130");
  check("tester row counted the events", Number(mine[0]?.events) >= 3, mine[0]?.events);
  check("tester row counted the session", Number(mine[0]?.sessions) >= 1, mine[0]?.sessions);

  const rows = await readTab("Events", true);
  const mineEvents = rows.filter((r) => r.email === TEST_EMAIL);
  check("three Events rows written", mineEvents.length === 3, `${mineEvents.length} rows`);
  const full = mineEvents.find((r) => r.type === "capture.fullpage");
  check("event keeps the redacted page path", full?.page === "shop.example.com/checkout");
  check("event keeps numeric columns", full?.sizeBytes === "482113" && full?.width === "1440");
  check("event date column is derived", full?.date === now.slice(0, 10));
  check(
    "unknown event types are namespaced, not dropped",
    mineEvents.some((r) => r.type === "other:totally-made-up"),
  );
  check(
    "no media column exists anywhere",
    !Object.keys(mineEvents[0] || {}).some((k) => /blob|image|video|data/i.test(k)),
  );

  const sessions = await readTab("Sessions", true);
  check(
    "a Sessions row was written",
    sessions.some((r) => r.email === TEST_EMAIL),
  );

  /* cleanup ------------------------------------------------------------- */
  await cleanup();
  console.log(`\n${failures ? `${failures} failure(s)` : "all ingest checks passed"} — sheet left clean`);
  process.exit(failures ? 1 : 0);
}

/** Remove every row this test wrote, newest first so indices stay valid. */
async function cleanup() {
  const { clientEmail, privateKey } = getServiceAccount();
  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const { token } = await auth.getAccessToken();

  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());
  const idOf = (title: string) =>
    meta.sheets.find((s: { properties: { title: string } }) => s.properties.title === title)
      ?.properties.sheetId;

  const requests: unknown[] = [];
  for (const tab of ["Events", "Sessions", "Testers"] as const) {
    const rows = await readTab(tab, true);
    const doomed = rows
      .filter((r) => r.email === TEST_EMAIL)
      .map((r) => Number(r.__row))
      .sort((a, b) => b - a);
    for (const rowNumber of doomed) {
      requests.push({
        deleteDimension: {
          range: {
            sheetId: idOf(tab),
            dimension: "ROWS",
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      });
    }
  }
  if (!requests.length) return;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  console.log(`\n  cleanup: removed ${requests.length} test row(s) — ${res.status}`);
  invalidate();
}

main().catch((err) => {
  console.error("\nFailed:", err);
  process.exit(1);
});
