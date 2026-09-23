/** Transactional email via Resend (REST — no SDK dependency). Node runtime. */

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email isn't configured (RESEND_API_KEY missing)." };
  const from = process.env.EMAIL_FROM || "Tudo <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}

export function otpEmailHtml(code: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f3fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:32px 16px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e9e8f3">
    <div style="background:#7178DD;padding:22px 28px;color:#fff;font-weight:800;font-size:20px">Tudo</div>
    <div style="padding:28px">
      <p style="margin:0 0 6px;font-size:15px;color:#2b2a3a">Your sign-in code</p>
      <p style="margin:0 0 18px;font-size:13px;color:#6c6a82">Enter this code to finish signing in. It expires in 10 minutes.</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#2b2a3a;background:#f4f3fb;border-radius:12px;padding:16px;text-align:center">${code}</div>
      <p style="margin:18px 0 0;font-size:12px;color:#9c9ab2">If you didn't try to sign in, you can ignore this email.</p>
    </div>
  </div></body></html>`;
}
