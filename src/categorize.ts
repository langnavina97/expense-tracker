import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const ai = new GoogleGenAI({ apiKey });

// Suggests the best-matching category for an expense title, constrained to
// the household's existing categories via a JSON schema enum - the model
// can only return one of the names we give it, never something made up.
// Synthetic option offered to the model alongside the real categories, so it
// has a way to say "none of these actually fit" instead of being forced to
// pick one (an enum-constrained response must be one of the given options).
const NO_MATCH = "Other";

const TIMEOUT_MS = 10_000;

// Three distinct outcomes, deliberately not collapsed into one: a matched
// category name, null when the model genuinely considered the title and
// found no good fit, and undefined when we couldn't get an answer at all
// (timeout, rate limit, outage) - callers should tell users "AI is
// unavailable right now" very differently from "AI found no match".
export async function suggestCategory(title: string, categoryNames: string[]): Promise<string | null | undefined> {
  if (categoryNames.length === 0) return null;

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        // A pinned, non-"-latest" lite model: aliases like "gemini-flash-latest"
        // drift to whatever the newest model is, which turned out to have a
        // 20-requests/day free-tier cap - far too low for real usage. Lite
        // models are also the right size for this simple classification task.
        model: "gemini-3.1-flash-lite",
        contents: `Existing categories: ${categoryNames.join(", ")}.\n\nWhich of these existing categories best fits this expense title: "${title}"? Only choose "${NO_MATCH}" if none of the listed categories are a reasonable fit.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.STRING,
            format: "enum",
            enum: [...categoryNames, NO_MATCH],
          },
        },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Gemini request timed out")), TIMEOUT_MS)),
    ]);

    const suggestion = response.text ? (JSON.parse(response.text) as string) : null;
    if (!suggestion) return undefined;
    return categoryNames.includes(suggestion) ? suggestion : null;
  } catch (error) {
    console.error("Error suggesting category:", error);
    return undefined;
  }
}
