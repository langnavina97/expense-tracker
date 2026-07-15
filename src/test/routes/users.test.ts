import { describe, it, expect } from "vitest";
import { validateUserInput } from "../../routes/users.js";

const validBody = {
  name: "Test User",
  email: "test@example.com",
  password: "correcthorsebatterystaple",
};

describe("validateUserInput", () => {
  describe("create (partial: false)", () => {
    it("passes with all required fields present", () => {
      expect(validateUserInput(validBody, { partial: false })).toBeNull();
    });

    it("fails when name is missing", () => {
      const { name, ...rest } = validBody;
      expect(validateUserInput(rest, { partial: false })).not.toBeNull();
    });

    it("fails when email is missing", () => {
      const { email, ...rest } = validBody;
      expect(validateUserInput(rest, { partial: false })).not.toBeNull();
    });

    it("fails when password is missing", () => {
      const { password, ...rest } = validBody;
      expect(validateUserInput(rest, { partial: false })).not.toBeNull();
    });
  });

  describe("update (partial: true)", () => {
    it("passes with an empty body (nothing being changed)", () => {
      expect(validateUserInput({}, { partial: true })).toBeNull();
    });

    it("passes when only name is provided", () => {
      expect(validateUserInput({ name: "New Name" }, { partial: true })).toBeNull();
    });

    it("fails when name is explicitly provided as an empty string", () => {
      expect(validateUserInput({ name: "" }, { partial: true })).not.toBeNull();
    });

    it("fails when email is explicitly provided as an empty string", () => {
      expect(validateUserInput({ email: "" }, { partial: true })).not.toBeNull();
    });
  });
});
