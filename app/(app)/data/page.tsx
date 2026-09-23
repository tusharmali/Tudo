import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOwnerId } from "@/lib/owner";
import { usageByUser } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Storage" };

function mb(bytes: number): string {
  return (bytes / 1048576).toFixed(2);
}
function kb(bytes: number): string {
  return (bytes / 1024).toFixed(1);
}

export default async function DataPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  // Owner-only — nobody else, not even other super-admins.
  const owner = await getOwnerId();
  if (!owner || user.sub !== owner) redirect("/dashboard");

  const { users, totals } = await usageByUser();
  const max = users[0]?.totalBytes || 1;

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>Storage by user</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>
            Neon footprint per person — database rows + their photo in the bucket. Use it to spot who&apos;s driving cost.
          </p>
        </div>
        <span className="pill p-peri">Owner only</span>
      </div>

      <div className="grid g-3" style={{ marginBottom: 18 }}>
        <div className="card pad">
          <div className="lbl">Total data</div>
          <div style={{ fontFamily: "var(--round)", fontWeight: 800, fontSize: 26 }}>{mb(totals.totalBytes)} MB</div>
        </div>
        <div className="card pad">
          <div className="lbl">Database rows</div>
          <div style={{ fontFamily: "var(--round)", fontWeight: 800, fontSize: 26 }}>{totals.rows.toLocaleString()}</div>
          <div className="tiny faint">{mb(totals.dbBytes)} MB</div>
        </div>
        <div className="card pad">
          <div className="lbl">Photos (bucket)</div>
          <div style={{ fontFamily: "var(--round)", fontWeight: 800, fontSize: 26 }}>{mb(totals.fileBytes)} MB</div>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ textAlign: "right" }}>Rows</th>
                <th style={{ textAlign: "right" }}>DB</th>
                <th style={{ textAlign: "right" }}>Photo</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ width: "26%" }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId || "unattributed"}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    {u.email && <div className="tiny faint">{u.email}</div>}
                  </td>
                  <td className="num" style={{ textAlign: "right" }}>{u.rows.toLocaleString()}</td>
                  <td className="num" style={{ textAlign: "right" }}>{kb(u.dbBytes)} KB</td>
                  <td className="num" style={{ textAlign: "right" }}>{u.fileBytes ? `${kb(u.fileBytes)} KB` : "—"}</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700 }}>{mb(u.totalBytes)} MB</td>
                  <td>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(2, Math.round((u.totalBytes / max) * 100))}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="tiny faint" style={{ textAlign: "center", padding: 22 }}>No data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted tiny" style={{ marginTop: 12 }}>
        DB size is the byte length of each person&apos;s rows across chat, tasks, WIP, attendance, kudos, concerns, leave, notifications and reactions — a close proxy for their Neon row footprint, not the exact on-disk size.
      </p>
    </>
  );
}
