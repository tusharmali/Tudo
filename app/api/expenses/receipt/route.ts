import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { getExpense } from "@/lib/expenses";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return new NextResponse(null, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const exp = await getExpense(id);
  if (!exp || !exp.receiptKey) return new NextResponse(null, { status: 404 });
  // Only the submitter or a manager can view the receipt.
  if (exp.userId !== u.sub && !isManager(u.role)) return new NextResponse(null, { status: 403 });
  const obj = await getObject(exp.receiptKey);
  if (!obj) return new NextResponse(null, { status: 404 });
  return new NextResponse(obj.body as unknown as BodyInit, {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=3600" },
  });
}
