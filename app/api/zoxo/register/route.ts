/**
 * POST /api/zoxo/register — an install says hello.
 * Creates/refreshes the Testers row, logs a Sessions row and returns the
 * remote Config the extension should apply.
 */
import type { NextRequest } from "next/server";
import { appendRows, checkIngestKey, getConfig, upsertTester, clip } from "@/lib/zoxo";
import { json, preflight, rateLimit } from "@/lib/zoxo-http";

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: NextRequest) {
  if (!checkIngestKey(req.headers.get("x-zoxo-key"))) {
    return json({ ok: false, error: "Invalid ingest key" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  const deviceId = clip(body.deviceId, 64);
  if (!rateLimit(`reg:${deviceId || "anon"}`, 20)) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const env = {
    deviceId,
    email: clip(body.email, 160).toLowerCase(),
    name: clip(body.name, 120),
    os: clip(body.os, 40),
    browser: clip(body.browser, 40),
    screen: clip(body.screen, 20),
    tz: clip(body.tz, 60),
    locale: clip(body.locale, 20),
    extVersion: clip(body.extVersion, 20),
  };
  const reason = clip(body.reason, 30) || "startup";

  try {
    const { testerId, created } = await upsertTester(env, {
      countSession: ["startup", "install", "signin"].includes(reason),
    });

    if (reason !== "test") {
      await appendRows("Sessions", [
        {
          id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          testerId,
          email: env.email,
          startedAt: new Date().toISOString(),
          reason,
          os: env.os,
          browser: env.browser,
          extVersion: env.extVersion,
        },
      ]);
    }

    const config = await getConfig().catch(() => ({}));
    return json({ ok: true, testerId, created, config });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 502);
  }
}
