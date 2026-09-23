/**
 * Object storage for display pictures — Neon's S3-compatible bucket.
 * The bucket is private, so images are streamed back through /api/avatar
 * (never a public URL). Only a short object key lives in the DB, keeping the
 * Users rows light. Node runtime only.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.AWS_S3_BUCKET || "icarus";

let _s3: S3Client | null = null;
function s3(): S3Client {
  if (_s3) return _s3;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  if (!endpoint) throw new Error("AWS_ENDPOINT_URL_S3 is not set.");
  _s3 = new S3Client({
    region: process.env.AWS_REGION || "ap-southeast-1",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  return _s3;
}

/** Is object storage configured? Lets callers fail gracefully when it isn't. */
export function storageReady(): boolean {
  return !!(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

/** Upload a display picture; returns the object key to store on the user. */
export async function putAvatar(userId: string, body: Buffer, contentType: string): Promise<string> {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";
  const key = `avatars/${userId}-${Date.now().toString(36)}.${ext}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return key;
}

/** Upload arbitrary bytes at a given key (e.g. expense receipts). */
export async function putBytes(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
  );
  return key;
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = await r.Body!.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: r.ContentType || "image/jpeg" };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!key) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    /* best-effort cleanup — a leftover object must not break the action */
  }
}

/** Size of a stored object in bytes (0 if missing / unreadable). */
export async function objectSize(key: string): Promise<number> {
  if (!key || !storageReady()) return 0;
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return r.ContentLength || 0;
  } catch {
    return 0;
  }
}
