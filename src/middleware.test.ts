import { describe, it, expect } from "vitest";
import { parseId } from "./middleware.js";

describe("parseId", () => {
  it("parses a valid integer string", () => {
    expect(parseId("42")).toBe(42);
  });

  it("returns null for a non-numeric string", () => {
    expect(parseId("abc")).toBeNull();
  });

  it("returns null for a decimal string", () => {
    expect(parseId("4.5")).toBeNull();
  });

  it("returns null when undefined", () => {
    expect(parseId(undefined)).toBeNull();
  });

  it("returns null when given an array (repeated route param)", () => {
    expect(parseId(["1", "2"])).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseId("")).toBeNull();
  });
});
