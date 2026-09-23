import webpush from "web-push";
import { allRows, appendRow, deleteWhere, genId } from "./db";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@tudo.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  const rows = await allRows("PushSubscriptions");
  if (rows.some((r) => r.endpoint === sub.endpoint)) return;
  await appendRow("PushSubscriptions", {
    id: genId("ps"),
    userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    createdAt: new Date().toISOString(),
  });
}

type Payload = { title: string; body: string; url?: string };

async function deliver(rows: { endpoint: string; p256dh: string; auth: string }[], payload: Payload): Promise<void> {
  const data = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, data);
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(r.endpoint);
      }
    }),
  );
  if (dead.length) await deleteWhere("PushSubscriptions", (r) => dead.includes(r.endpoint));
}

export async function sendToAll(payload: Payload): Promise<void> {
  if (!ensureConfigured()) return;
  await deliver((await allRows("PushSubscriptions")) as unknown as { endpoint: string; p256dh: string; auth: string }[], payload);
}

/** Push only to the given user ids (for department / targeted broadcasts). */
export async function sendToUsers(userIds: string[], payload: Payload): Promise<void> {
  if (!ensureConfigured() || !userIds.length) return;
  const set = new Set(userIds);
  const rows = (await allRows("PushSubscriptions")).filter((r) => set.has(r.userId));
  await deliver(rows as unknown as { endpoint: string; p256dh: string; auth: string }[], payload);
}
