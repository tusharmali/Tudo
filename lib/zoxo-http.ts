/**
 * Zoxo backend — shared HTTP bits for the ingest endpoints.
 * The client is a Chrome extension (origin chrome-extension://<id>), so these
 * routes are CORS-open but protected by a shared ingest key.
 */
import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Zoxo-Key",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Crude per-instance throttle so one looping client cannot flood the sheet. */
const hits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;

export function rateLimit(key: string, max: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  if (hits.size > 5000) hits.clear();
  return entry.count <= max;
}
