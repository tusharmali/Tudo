# Tudo — Setup (one-time, ~10 minutes)

Tudo runs on **Next.js** with a **Google Sheet** as its database, reached through a
free Google **service account**. Running cost: **$0**.

You only need to do this once. Steps 1–3 happen in your browser (your Google
account); steps 4–6 happen in this `tudo/` folder.

---

## 1. Create the backend Google Sheet
1. Open <https://sheets.new> — a blank spreadsheet appears.
2. Name it something like **Tudo Backend**.
3. Copy its **ID** from the URL (the long part between `/d/` and `/edit`):
   `https://docs.google.com/spreadsheets/d/`**`THIS_IS_THE_ID`**`/edit`

## 2. Create the service account (the "robot" — free, no card)
1. Go to <https://console.cloud.google.com>. Top bar → **New Project** → name it **Tudo** → Create.
2. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Name it `tudo-bot` → Create → Done.
4. Click the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads — keep it safe.
5. Copy the service account's **email** — it looks like
   `tudo-bot@tudo-xxxxxx.iam.gserviceaccount.com`.

## 3. Share the sheet with the robot
Open your **Tudo Backend** sheet → **Share** → paste the service-account email →
set it to **Editor** → Send. (You can untick "Notify people".)

## 4. Fill in `.env.local`
Open **`tudo/.env.local`** and set:

| Variable | Value |
|---|---|
| `GOOGLE_SHEET_ID` | the ID from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_B64` | base64 of your JSON key (command below) |
| `AUTH_SECRET` | a dev one is set; make your own with `openssl rand -base64 32` |
| `SEED_ADMIN_EMAIL` | the email you'll log in with |
| `SEED_ADMIN_PASSWORD` | your login password |
| `SEED_ADMIN_NAME` | your display name |

Turn the JSON key into one line for `GOOGLE_SERVICE_ACCOUNT_B64`:

```bash
base64 -w0 ~/Downloads/tudo-xxxxxx-abc123.json
```
_(macOS: `base64 -i ~/Downloads/your-key.json | tr -d '\n'`)_

Paste the whole one-line output as the value.

## 5. Build the sheet + your login
```bash
npm run init-sheet
```
This creates all 16 tabs with their columns and seeds your super-admin account.
It's safe to re-run — it only adds what's missing.

## 6. Run it
```bash
npm run dev
```
Open <http://localhost:3000> and sign in with your `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`.

---

### Notes
- `.env.local` and any `*.json` key are **git-ignored** — they never get committed.
- `OPENROUTER_API_KEY` is only needed later, for the AI update summaries.
- **Deploying to Vercel** later: add the same variables under the Vercel project's
  **Settings → Environment Variables**, then deploy.
- Employees are added by a super-admin from inside the app (coming with the HR
  module) — you only seed the first super-admin here.
