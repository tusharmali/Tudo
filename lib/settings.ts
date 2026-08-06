import { readConfig, setConfig } from "./db";

export async function getSettings(): Promise<Record<string, string>> {
  return readConfig("Settings");
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const s = await readConfig("Settings");
  return s[key] ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await setConfig("Settings", key, value);
}
