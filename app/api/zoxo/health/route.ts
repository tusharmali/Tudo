/**
 * GET /api/zoxo/health — is the Zoxo backend wired up correctly?
 * Reports whether the sheet id, credentials and tabs are in place. Never
 * returns tester data.
 */
import { getZoxoSheetId, getIngestKey, readTab } from "@/lib/zoxo";
import { json, preflight } from "@/lib/zoxo-http";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  const report: Record<string, unknown> = {
    ok: false,
    service: "zoxo",
    sheetConfigured: false,
    ingestKeySet: !!getIngestKey(),
  };
  try {
    report.sheetId = `${getZoxoSheetId().slice(0, 8)}…`;
    report.sheetConfigured = true;
    const testers = await readTab("Testers", true);
    report.testers = testers.length;
    report.ok = true;
  } catch (err) {
    report.error = (err as Error).message;
  }
  return json(report, report.ok ? 200 : 500);
}
