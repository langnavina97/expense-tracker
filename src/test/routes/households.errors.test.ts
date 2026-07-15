import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../prisma.js";
import { createAuthenticatedAgent } from "../helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("households routes - unexpected database errors fall through to the generic error handler", () => {
  it("POST / returns 500 on an unexpected database error", async () => {
    const agent = request.agent(app);
    await agent.post("/users").send({
      name: "No Household",
      email: "no-household-error@example.com",
      password: "correcthorsebatterystaple",
    });
    await agent.post("/users/login").send({
      email: "no-household-error@example.com",
      password: "correcthorsebatterystaple",
    });

    vi.spyOn(prisma.household, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/households").send({ name: "The Langs" });
    expect(response.status).toBe(500);
  });

  it("GET / returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    vi.spyOn(prisma.household, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/households");
    expect(response.status).toBe(500);
  });

  it("POST /members returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/households/members").send({ userId: 1, role: "ADULT" });
    expect(response.status).toBe(500);
  });

  it("POST /dependents returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    vi.spyOn(prisma.dependent, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/households/dependents").send({ name: "Kid1" });
    expect(response.status).toBe(500);
  });
});
