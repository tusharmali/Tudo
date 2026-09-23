"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitExpenseAction, decideExpenseAction, deleteExpenseAction } from "@/app/actions/expenses";
import { toast } from "@/components/Toaster";

type Row = { id: string; userId: string; name: string; dept: string; amount: string; category: string; note: string; date: string; hasReceipt: boolean; status: string };

const STATUS: Record<string, string> = { pending: "p-warn", approved: "p-good", rejected: "p-bad", paid: "p-sky" };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read file."));
    r.readAsDataURL(file);
  });
}

export default function ExpensesClient({ me, isManager, expenses, categories, today }: { me: string; isManager: boolean; expenses: Row[]; categories: string[]; today: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("all");

  const view = useMemo(() => expenses.filter((e) => filter === "all" || e.status === filter), [expenses, filter]);
  const totals = useMemo(() => {
    const sum = (s: string) => expenses.filter((e) => e.status === s).reduce((t, e) => t + Number(e.amount || 0), 0);
    return { pending: sum("pending"), approved: sum("approved"), paid: sum("paid") };
  }, [expenses]);

  async function submit() {
    if (saving) return;
    if (!(Number(amount) > 0)) return toast("Enter a valid amount");
    setSaving(true);
    let receiptData = "";
    try {
      if (receipt) receiptData = await fileToDataUrl(receipt);
    } catch {
      setSaving(false);
      return toast("Couldn't read the receipt");
    }
    const r = await submitExpenseAction({ amount, category, note, date, receipt: receiptData });
    if (r.ok) {
      toast(r.message || "Submitted");
      setAmount("");
      setNote("");
      setReceipt(null);
      router.refresh();
    } else toast(r.error || "Error");
    setSaving(false);
  }

  async function decide(id: string, status: string) {
    setBusy(id);
    const r = await decideExpenseAction({ id, status: status as "approved" | "rejected" | "paid" });
    if (r.ok) { toast(r.message || "Done"); router.refresh(); } else toast(r.error || "Error");
    setBusy("");
  }
  async function del(id: string) {
    if (!window.confirm("Remove this expense?")) return;
    setBusy(id);
    const r = await deleteExpenseAction({ id });
    if (r.ok) { toast(r.message || "Removed"); router.refresh(); } else toast(r.error || "Error");
    setBusy("");
  }

  return (
    <>
      <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--round)" }}>Expenses</h2>
          <p className="muted tiny" style={{ margin: "3px 0 0" }}>Log a spend, attach the bill, and get it approved.</p>
        </div>
        {isManager && (
          <a className="btn btn-ghost" href="/api/expenses/export" download>⬇ Export for HR (Excel)</a>
        )}
      </div>

      {isManager && (
        <div className="grid g-3" style={{ marginBottom: 16 }}>
          <div className="card pad"><div className="lbl">Pending</div><div style={{ fontFamily: "var(--round)", fontWeight: 800, fontSize: 22 }}>₹{totals.pending.toFixed(2)}</div></div>
          <div className="card pad"><div className="lbl">Approved (unpaid)</div><div style={{ fontFamily: "var(--round)", fontWeight: 800, fontSize: 22 }}>₹{totals.approved.toFixed(2)}</div></div>
          <div className="card pad"><div className="lbl">Paid</div><div style={{ fontFamily: "var(--round)", fontWeight: 800, fontSize: 22 }}>₹{totals.paid.toFixed(2)}</div></div>
        </div>
      )}

      <div className="grid g-2-1" style={{ alignItems: "start" }}>
        {/* Submit */}
        <div className="card pad" style={{ order: 2 }}>
          <h3 className="sec" style={{ marginBottom: 12 }}>Add an expense</h3>
          <div className="grid g-2" style={{ gap: 10, marginBottom: 10 }}>
            <div><label className="lbl">Amount (₹)</label><input className="inp" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} /></div>
            <div><label className="lbl">Date</label><input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <label className="lbl">Category</label>
          <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginBottom: 10 }}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="lbl">Note</label>
          <input className="inp" placeholder="e.g. Adobe subscription" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 10 }} />
          <label className="lbl">Receipt / invoice (optional)</label>
          <input className="inp" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} style={{ marginBottom: 14, padding: 8 }} />
          <button className="btn btn-primary btn-block" onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit expense"}</button>
        </div>

        {/* List */}
        <div className="card" style={{ order: 1 }}>
          <div className="between" style={{ padding: "16px 18px 8px" }}>
            <h3 className="sec" style={{ margin: 0 }}>{isManager ? "All expenses" : "My expenses"}</h3>
            <select className="inp" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 150, padding: "5px 8px", fontSize: 12.5 }}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  {isManager && <th>Person</th>}
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.map((e) => {
                  const canDelete = isManager || (e.userId === me && e.status === "pending");
                  return (
                    <tr key={e.id}>
                      <td className="tiny num" style={{ whiteSpace: "nowrap" }}>{e.date}</td>
                      {isManager && <td className="tiny" style={{ whiteSpace: "nowrap" }}>{e.name}</td>}
                      <td className="tiny">
                        {e.category}
                        {e.note && <div className="tiny faint">{e.note}</div>}
                        {e.hasReceipt && <a className="tiny" href={`/api/expenses/receipt?id=${e.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-ink)" }}>📎 receipt</a>}
                      </td>
                      <td className="num" style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>₹{Number(e.amount).toFixed(2)}</td>
                      <td><span className={`pill ${STATUS[e.status] || "p-neut"}`}>{e.status}</span></td>
                      <td>
                        <div className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {isManager && e.status === "pending" && (
                            <>
                              <button className="chip" disabled={busy === e.id} onClick={() => decide(e.id, "approved")} style={{ padding: "4px 8px", fontSize: 11, color: "var(--good)" }}>Approve</button>
                              <button className="chip" disabled={busy === e.id} onClick={() => decide(e.id, "rejected")} style={{ padding: "4px 8px", fontSize: 11, color: "var(--bad)" }}>Reject</button>
                            </>
                          )}
                          {isManager && e.status === "approved" && (
                            <button className="chip" disabled={busy === e.id} onClick={() => decide(e.id, "paid")} style={{ padding: "4px 8px", fontSize: 11, color: "var(--accent-ink)" }}>Mark paid</button>
                          )}
                          {canDelete && (
                            <button className="chip" disabled={busy === e.id} onClick={() => del(e.id)} style={{ padding: "4px 8px", fontSize: 11 }}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {view.length === 0 && <tr><td colSpan={isManager ? 6 : 5} className="tiny faint" style={{ textAlign: "center", padding: 22 }}>No expenses{filter !== "all" ? ` (${filter})` : ""} yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
