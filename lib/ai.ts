import { getSetting } from "./settings";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Tried in order until one returns content. Spread across providers so a
// single provider's shared-pool rate limit doesn't kill the whole feature.
const FALLBACK_MODELS = [
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export function aiEnabled(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/** Summarize everyone's individual updates into a short "Overall Update". */
export async function generateOverall(updatesText: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OpenRouter API key isn't set. Add OPENROUTER_API_KEY to run AI summaries.");

  const configured = (await getSetting("ai.model")).trim();
  const models = [configured, ...FALLBACK_MODELS].filter(Boolean);
  const messages = [
    {
      role: "system",
      content:
        "You are a concise engineering manager writing the end-of-day 'Overall Update' for the company owner. " +
        "Read the team's individual updates and produce a short, factual summary as bullet points, each line starting with 'o '. " +
        "Group related work, call out blockers and what's live/stable, keep it tight. Do not invent anything not in the updates. Output only the bullets.",
    },
    { role: "user", content: updatesText },
  ];

  const seen = new Set<string>();
  let lastErr = "unknown error";
  for (const model of models) {
    if (seen.has(model)) continue;
    seen.add(model);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tudo.app",
          "X-Title": "Tudo",
        },
        body: JSON.stringify({ model, temperature: 0.4, messages }),
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = (await res.json()) as {
        error?: { message?: string };
        choices?: { message?: { content?: string } }[];
      };
      if (data.error) {
        lastErr = data.error.message || "provider error";
        continue;
      }
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
      lastErr = "empty response";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "request failed";
    }
  }
  throw new Error(`The AI is busy right now — free models are rate-limited. Try again in a moment. (${lastErr})`);
}
