import { describe, it, expect, vi, afterEach } from "vitest";
import { getExchangeRate } from "../exchangeRate.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getExchangeRate", () => {
  it("returns the original amount unchanged when from === to (no API call)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await getExchangeRate("USD", "USD", 1500);

    expect(result).toBe(1500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("converts the amount using the fetched rate, rounded to the nearest cent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ amount: 1, base: "MXN", date: "2026-07-08", rates: { USD: 0.0524 } }),
      })
    );

    // 1500 cents * 0.0524 = 78.6 -> rounds to 79
    const result = await getExchangeRate("MXN", "USD", 1500);

    expect(result).toBe(79);
  });

  it("returns null when the API response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    const result = await getExchangeRate("MXN", "USD", 1500);

    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    const result = await getExchangeRate("MXN", "USD", 1500);

    expect(result).toBeNull();
  });
});
