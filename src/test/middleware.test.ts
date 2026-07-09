import { describe, it, expect, vi } from "vitest";
import express from "express";
import { parseId, errorHandler } from "../middleware.js";

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

describe("errorHandler", () => {
  it("logs the error and responds with a generic 500", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as express.Response;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), {} as express.Request, res, vi.fn());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "An unexpected error occurred." });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
