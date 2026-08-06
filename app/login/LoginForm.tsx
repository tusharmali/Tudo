"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form className="login-card" action={action}>
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

      {state?.error && <p className="form-error">{state.error}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
