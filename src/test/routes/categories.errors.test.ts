import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../prisma.js";
import { createAuthenticatedAgent } from "../helpers.js";

let agent: Awaited<ReturnType<typeof createAuthenticatedAgent>>;

beforeEach(async () => {
  agent = await createAuthenticatedAgent();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("categories routes - unexpected database errors fall through to the generic error handler", () => {
  it("GET / returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.category, "findMany").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/categories");
    expect(response.status).toBe(500);
  });

  it("GET /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.category, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/categories/1");
    expect(response.status).toBe(500);
  });

  it("POST / returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.category, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/categories").send({ name: "Food" });
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.category, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch("/categories/1").send({ name: "Food" });
    expect(response.status).toBe(500);
  });

  it("DELETE /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.category, "delete").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete("/categories/1");
    expect(response.status).toBe(500);
  });
});
