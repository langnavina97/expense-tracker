import { describe, it, expect } from "vitest";
import { validateCategoryInput } from "../../routes/categories.js";

describe("validateCategoryInput", () => {
  describe("create (partial: false)", () => {
    it("passes when name is present", () => {
      expect(validateCategoryInput({ name: "Food" }, { partial: false })).toBeNull();
    });

    it("fails when name is missing", () => {
      expect(validateCategoryInput({}, { partial: false })).not.toBeNull();
    });

    it("fails when name is an empty string", () => {
      expect(validateCategoryInput({ name: "" }, { partial: false })).not.toBeNull();
    });
  });

  describe("update (partial: true)", () => {
    it("passes with an empty body (nothing being changed)", () => {
      expect(validateCategoryInput({}, { partial: true })).toBeNull();
    });

    it("passes when name is provided and non-empty", () => {
      expect(validateCategoryInput({ name: "Travel" }, { partial: true })).toBeNull();
    });

    it("fails when name is explicitly provided as an empty string", () => {
      expect(validateCategoryInput({ name: "" }, { partial: true })).not.toBeNull();
    });
  });
});
