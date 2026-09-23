"use client";

import { useActionState } from "react";
import { login, verifyOtp } from "@/app/actions/auth";

export default function LoginForm({ next }: { next: string }) {
  const [loginState, loginAction, loginPending] = useActionState(login, undefined);
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyOtp, undefined);

  // Once the password step asks for a code, switch to the code form.
  const codePhase = !!loginState?.twofa;
  const email = verifyState?.email || loginState?.email || "";

  if (codePhase) {
    return (
      <form className="login-card" action={verifyAction}>
        <div className="brand">
          <div className="brand-mark">T</div>
          <div className="brand-name">Tudo</div>
        </div>
        <h1>Check your email</h1>
        <p className="sub">We sent a 6-digit code to {email || "your email"}.</p>

        <input type="hidden" name="next" value={next} />

        <div className="field">
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
            style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
            suppressHydrationWarning
          />
        </div>

        <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer", margin: "2px 0 12px", fontSize: 13.5 }}>
          <input type="checkbox" name="remember" defaultChecked style={{ accentColor: "var(--accent)" }} />
          Remember this device for 30 days
        </label>

        {verifyState?.error && <p className="form-error">{verifyState.error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={verifyPending}>
          {verifyPending ? "Verifying…" : "Verify & sign in →"}
        </button>
        <p className="sub" style={{ marginTop: 12, textAlign: "center" }}>
          <a href="/login" style={{ color: "var(--accent-ink)", textDecoration: "none" }}>← Use a different account</a>
        </p>
      </form>
    );
  }

  return (
    <form className="login-card" action={loginAction}>
      <div className="brand">
        <div className="brand-mark">T</div>
        <div className="brand-name">Tudo</div>
      </div>
      <h1>
        Everything your team
        <br />
        does, in one place.
      </h1>
      <p className="sub">Sign in to your workspace.</p>

      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required suppressHydrationWarning />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required suppressHydrationWarning />
      </div>

      {loginState?.error && <p className="form-error">{loginState.error}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={loginPending}>
        {loginPending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
