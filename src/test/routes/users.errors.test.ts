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

const validUser = {
  name: "Test User",
  email: "test@example.com",
  password: "correcthorsebatterystaple",
};

describe("users routes - unexpected database errors fall through to the generic error handler", () => {
  it("POST / returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/users").send(validUser);
    expect(response.status).toBe(500);
  });

  it("POST /login returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const response = await agent
      .post("/users/login")
      .send({ email: validUser.email, password: validUser.password });
    expect(response.status).toBe(500);
  });

  it("GET / returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "findMany").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/users");
    expect(response.status).toBe(500);
  });

  it("GET /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/users/1");
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch("/users/1").send({ name: "Someone" });
    expect(response.status).toBe(500);
  });

  it("DELETE /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "delete").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete("/users/1");
    expect(response.status).toBe(500);
  });
});
