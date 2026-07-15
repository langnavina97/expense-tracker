import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../prisma.js";
import { createAuthenticatedAgent } from "./helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /health", () => {
  it("returns OK", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });
});

describe("requireAuth", () => {
  it("rejects a request to a protected route with no session", async () => {
    const response = await request(app).get("/expenses");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required.");
  });

  it("allows a request to a protected route once authenticated", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.get("/expenses");

    expect(response.status).toBe(200);
  });

  it("rejects a session whose user was deleted through another path (soft delete)", async () => {
    const { agent, userId } = await createAuthenticatedAgent();

    vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
      id: userId,
      deletedAt: new Date(),
    } as any);

    const response = await agent.get("/expenses");

    expect(response.status).toBe(401);
  });
});
