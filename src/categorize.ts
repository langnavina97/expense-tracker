import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const ai = new GoogleGenAI({ apiKey });

// Suggests the best-matching category for an expense title, constrained to
// the household's existing categories via a JSON schema enum - the model
// can only return one of the names we give it, never something made up.
// Returns null if there's nothing to suggest from, or if the call fails;
// this is an optional convenience, never something a request should fail on.
// Synthetic option offered to the model alongside the real categories, so it
// has a way to say "none of these actually fit" instead of being forced to
// pick one (an enum-constrained response must be one of the given options).
const NO_MATCH = "Other";

export async function suggestCategory(title: string, categoryNames: string[]): Promise<string | null> {
  if (categoryNames.length === 0) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Which category best fits this expense title: "${title}"? If none fit well, choose "${NO_MATCH}".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.STRING,
          format: "enum",
          enum: [...categoryNames, NO_MATCH],
        },
      },
    });

    const suggestion = response.text ? (JSON.parse(response.text) as string) : null;
    return suggestion && categoryNames.includes(suggestion) ? suggestion : null;
  } catch (error) {
    console.error("Error suggesting category:", error);
    return null;
  }
}
