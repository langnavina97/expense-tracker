import { describe, it, expect } from "vitest";
import { formatMoney, spenderName } from "../utils";
import type { Household } from "../types";

describe("formatMoney", () => {
  it("formats cents as a currency string", () => {
    expect(formatMoney(1000, "USD")).toBe("$10.00");
  });

  it("handles zero", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("formats a different currency correctly", () => {
    expect(formatMoney(1000, "EUR")).toContain("10.00");
  });
});

describe("spenderName", () => {
  const household: Household = {
    id: 1,
    name: "Test Household",
    members: [
      { id: 1, email: "a@b.com", name: "Alice", googleId: null, householdId: 1, role: "LEAD", spenderId: 10, deletedAt: null },
    ],
    dependents: [{ id: 1, name: "Kid", householdId: 1, spenderId: 20 }],
  };

  it("finds a member by spenderId", () => {
    expect(spenderName(10, household)).toBe("Alice");
  });

  it("finds a dependent by spenderId", () => {
    expect(spenderName(20, household)).toBe("Kid");
  });

  it("returns Unknown for an unrecognized spenderId", () => {
    expect(spenderName(999, household)).toBe("Unknown");
  });
});
