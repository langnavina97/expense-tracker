import { describe, it, expect, vi, afterEach } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: generateContentMock } };
  }),
  Type: { STRING: "STRING" },
}));

const { suggestCategory } = await import("../categorize.js");

afterEach(() => {
  generateContentMock.mockReset();
});

describe("suggestCategory", () => {
  it("returns null without calling the API when there are no categories to choose from", async () => {
    const result = await suggestCategory("Tacos", []);

    expect(result).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("returns the suggested category when it's a valid match", async () => {
    generateContentMock.mockResolvedValueOnce({ text: '"Food"' });

    const result = await suggestCategory("Tacos", ["Food", "Travel"]);

    expect(result).toBe("Food");
  });

  it("returns null if the model suggests something outside the given list", async () => {
    generateContentMock.mockResolvedValueOnce({ text: '"NotARealCategory"' });

    const result = await suggestCategory("Tacos", ["Food", "Travel"]);

    expect(result).toBeNull();
  });

  it("returns undefined if the response has no text", async () => {
    generateContentMock.mockResolvedValueOnce({ text: undefined });

    const result = await suggestCategory("Tacos", ["Food", "Travel"]);

    expect(result).toBeUndefined();
  });

  it("returns undefined if the API call fails", async () => {
    generateContentMock.mockRejectedValueOnce(new Error("API down"));

    const result = await suggestCategory("Tacos", ["Food", "Travel"]);

    expect(result).toBeUndefined();
  });

  it("returns undefined if the API call times out", async () => {
    vi.useFakeTimers();
    generateContentMock.mockImplementationOnce(() => new Promise(() => {}));

    const resultPromise = suggestCategory("Tacos", ["Food", "Travel"]);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(result).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("module load", () => {
  it("throws immediately if GEMINI_API_KEY isn't set", async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.resetModules();

    await expect(import("../categorize.js")).rejects.toThrow("GEMINI_API_KEY is not set");

    process.env.GEMINI_API_KEY = original;
    vi.resetModules();
  });
});
