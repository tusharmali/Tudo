export type Res<T = undefined> = { ok: boolean; error?: string; message?: string; data?: T };

export function actionError<T = undefined>(e: unknown): Res<T> {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}
