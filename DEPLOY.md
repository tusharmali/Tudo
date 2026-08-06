# Deploying Tudo to Vercel

Tudo is a standard Next.js app — Vercel deploys it with zero config. You only need to set the environment variables (your `.env.local` is git-ignored and never pushed).

## Option A — GitHub + Vercel (recommended)

**1. Push the code to a Git repo**
```bash
cd tudo
git add -A
git commit -m "Tudo dashboard"
git branch -M main
git remote add origin https://github.com/<you>/tudo.git
git push -u origin main
```

**2. Import in Vercel**
- Go to <https://vercel.com/new> and import the repo.
- Framework preset **Next.js** is auto-detected — leave build settings default.

**3. Add Environment Variables** (Project → Settings → Environment Variables → Production)

| Name | Where to get it |
|---|---|
| `GOOGLE_SHEET_ID` | from `.env.local` |
| `GOOGLE_SERVICE_ACCOUNT_B64` | from `.env.local` (the long base64 blob) |
| `AUTH_SECRET` | **generate a fresh one:** `openssl rand -base64 32` |
| `OPENROUTER_API_KEY` | from `.env.local` |
| `VAPID_PUBLIC_KEY` | from `.env.local` |
| `VAPID_PRIVATE_KEY` | from `.env.local` |
| `VAPID_SUBJECT` | `mailto:you@company.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` |

**4. Deploy** → Vercel gives you `https://tudo-xxx.vercel.app`.

**5. Sign in** with your super-admin (`tushar.icarussolution@gmail.com`).

## Option B — Vercel CLI
```bash
npm i -g vercel
cd tudo
vercel                 # links/creates the project
# add each env var:
vercel env add GOOGLE_SHEET_ID production
vercel env add GOOGLE_SERVICE_ACCOUNT_B64 production
vercel env add AUTH_SECRET production
vercel env add OPENROUTER_API_KEY production
vercel env add VAPID_PUBLIC_KEY production
vercel env add VAPID_PRIVATE_KEY production
vercel env add VAPID_SUBJECT production
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
vercel --prod
```

## First-run checklist (as super-admin)
1. **Attendance → "Use my location as office"** — do this standing at the office so GPS check-in can enforce the geofence.
2. **Attendance → "Add a teammate"** — create logins for your team.
3. **Install on phones** — open the URL on mobile → *Add to Home Screen*. Web push works over Vercel's HTTPS (on iOS, push only fires once installed to the home screen).

## Notes
- Vercel's free **Hobby** plan is technically non-commercial. It's fine in practice for a small internal tool; to be 100% clean, **Cloudflare Pages** runs the same app free with commercial use allowed.
- Google Sheets API free quota (~300 reads/min) is plenty for ~20 people.
- The **AI** uses free OpenRouter models with automatic fallback across providers; if all are momentarily rate-limited it says "try again in a moment." To make it rock-solid, add a tiny OpenRouter credit balance and switch `Settings → ai.model` to a cheap paid model like `openai/gpt-4o-mini`.
