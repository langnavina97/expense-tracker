import { describe, it, expect } from "vitest";
import { validateExpenseInput } from "./expenses.js";

const validBody = {
  categoryId: 1,
  spender: "you",
  currency: "USD",
  amount: 1500,
  date: "2026-07-08",
};

describe("validateExpenseInput", () => {
  describe("create (partial: false)", () => {
    it("passes with all required fields present", () => {
      expect(validateExpenseInput(validBody, { partial: false })).toBeNull();
    });

    it("fails when spender is missing", () => {
      const { spender, ...rest } = validBody;
      expect(validateExpenseInput(rest, { partial: false })).not.toBeNull();
    });

    it("fails when categoryId is missing", () => {
      const { categoryId, ...rest } = validBody;
      expect(validateExpenseInput(rest, { partial: false })).not.toBeNull();
    });

    it("fails when date is missing", () => {
      const { date, ...rest } = validBody;
      expect(validateExpenseInput(rest, { partial: false })).not.toBeNull();
    });

    it("allows amount of 0 (not treated as missing)", () => {
      expect(validateExpenseInput({ ...validBody, amount: 0 }, { partial: false })).toBeNull();
    });

    it("fails on an unsupported currency", () => {
      const error = validateExpenseInput({ ...validBody, currency: "XYZ" }, { partial: false });
      expect(error).toContain("Unsupported currency");
    });
  });

  describe("update (partial: true)", () => {
    it("passes with an empty body (nothing being changed)", () => {
      expect(validateExpenseInput({}, { partial: true })).toBeNull();
    });

    it("passes when only one field is provided", () => {
      expect(validateExpenseInput({ amount: 2000 }, { partial: true })).toBeNull();
    });

    it("still rejects an unsupported currency if one is provided", () => {
      const error = validateExpenseInput({ currency: "XYZ" }, { partial: true });
      expect(error).toContain("Unsupported currency");
    });
  });
});
