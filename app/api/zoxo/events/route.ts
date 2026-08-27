/**
 * POST /api/zoxo/events — activity rows from the Zoxo extension.
 *
 * Body: { events: ZoxoEvent[] }  (max 200 per call)
 * Never accepts media: any unknown field is dropped, and the row shape is
 * fixed by lib/zoxo-schema.ts.
 */
import type { NextRequest } from "next/server";
import { appendRows, checkIngestKey, upsertTester, clip, toNumberString, type Row } from "@/lib/zoxo";
import { json, preflight, rateLimit } from "@/lib/zoxo-http";
import { ZOXO_EVENT_TYPES } from "@/lib/zoxo-schema";

const MAX_EVENTS = 200;
const VALID_TYPES = new Set<string>(ZOXO_EVENT_TYPES);

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  if (!checkIngestKey(req.headers.get("x-zoxo-key"))) {
    return json({ ok: false, error: "Invalid ingest key" }, 401);
  }

  let body: { events?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  const incoming = Array.isArray(body.events) ? body.events : [];
  if (!incoming.length) return json({ ok: true, accepted: 0 });
  if (incoming.length > MAX_EVENTS) {
    return json({ ok: false, error: `Send at most ${MAX_EVENTS} events per request` }, 413);
  }

  const first = incoming[0] as Record<string, unknown>;
  const deviceId = clip(first?.deviceId, 64);
  if (!rateLimit(`ev:${deviceId || req.headers.get("x-forwarded-for") || "anon"}`, 60)) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  let testerId = "";
  try {
    const res = await upsertTester(
      {
        deviceId,
        email: clip(first?.email, 160),
        name: clip(first?.name, 120),
        os: clip(first?.os, 40),
        browser: clip(first?.browser, 40),
        screen: clip(first?.screen, 20),
        tz: clip(first?.tz, 60),
        locale: clip(first?.locale, 20),
        extVersion: clip(first?.extVersion, 20),
      },
      { addEvents: incoming.length },
    );
    testerId = res.testerId;
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 502);
  }

  const rows: Row[] = incoming.map((raw) => {
    const e = raw as Record<string, unknown>;
    const ts = typeof e.ts === "string" && e.ts ? e.ts : new Date().toISOString();
    const type = clip(e.type, 40);
    return {
      id: clip(e.id, 40),
      ts,
      date: ts.slice(0, 10),
      testerId,
      email: clip(e.email, 160).toLowerCase(),
      name: clip(e.name, 120),
      type: VALID_TYPES.has(type) ? type : `other:${type}`,
      mode: clip(e.mode, 30),
      page: clip(e.page, 300),
      pageTitle: clip(e.pageTitle, 200),
      durationMs: toNumberString(e.durationMs),
      sizeBytes: toNumberString(e.sizeBytes),
      width: toNumberString(e.width),
      height: toNumberString(e.height),
      format: clip(e.format, 40),
      meta: clip(e.meta, 500),
      deviceId: clip(e.deviceId, 64),
      os: clip(e.os, 40),
      browser: clip(e.browser, 40),
      extVersion: clip(e.extVersion, 20),
    };
  });

  try {
    const accepted = await appendRows("Events", rows);
    return json({ ok: true, accepted, testerId });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 502);
  }
}
