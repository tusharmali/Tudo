import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/users";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Streams a member's display picture from the private bucket.
 *  URL: /api/avatar?u=<userId>&v=<cache-buster>. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("u") || "";
  if (!id) return new NextResponse(null, { status: 400 });

  const user = await getUserById(id);
  const key = user?.avatar || "";
  if (!key) return new NextResponse(null, { status: 404 });

  const obj = await getObject(key);
  if (!obj) return new NextResponse(null, { status: 404 });

  return new NextResponse(obj.body as unknown as BodyInit, {
    headers: {
      "Content-Type": obj.contentType,
      // The ?v= key changes whenever the photo changes, so this is safe to pin.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
