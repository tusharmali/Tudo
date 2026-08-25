export type Res<T = undefined> = { ok: boolean; error?: string; message?: string; data?: T };

export function actionError<T = undefined>(e: unknown): Res<T> {
  const raw = e instanceof Error ? e.message : "";
  // The Google service account can read the sheet but has lost write access.
  // Surface something actionable instead of the raw library error.
  if (/\b403\b/.test(raw) && /permission/i.test(raw)) {
    return {
      ok: false,
      error: "Couldn't save — the app's Google Sheet is in read-only mode. An owner needs to re-share it with the service account as Editor, then try again.",
    };
  }
  if (/\b429\b/.test(raw) || /quota/i.test(raw)) {
    return { ok: false, error: "The backend is busy right now. Wait a few seconds and try again." };
  }
  return { ok: false, error: raw || "Something went wrong." };
}
