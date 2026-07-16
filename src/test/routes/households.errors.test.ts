import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { prisma } from "../../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
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
    const otherAgent = request.agent(app);
    const otherUser = await otherAgent.post("/users").send({
      name: "No Household",
      email: "members-500@example.com",
      password: "correcthorsebatterystaple",
    });

    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/households/members").send({ userId: otherUser.body.id, role: "ADULT" });
    expect(response.status).toBe(500);
  });

  it("POST /members returns 500 if the target-user lookup itself fails unexpectedly", async () => {
    const { agent, userId } = await createAuthenticatedAgent();
    // requireAuth does its own findUnique first (to load the caller) - let
    // that succeed, and only fail the route handler's own lookup.
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    vi.spyOn(prisma.user, "findUnique")
      .mockResolvedValueOnce(currentUser as any)
      .mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/households/members").send({ userId: 1, role: "ADULT" });
    expect(response.status).toBe(500);
  });

  it("POST /members returns 404 if the target user was deleted between the check and the update (race condition)", async () => {
    const { agent } = await createAuthenticatedAgent();
    const otherAgent = request.agent(app);
    const otherUser = await otherAgent.post("/users").send({
      name: "No Household",
      email: "members-race@example.com",
      password: "correcthorsebatterystaple",
    });

    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.post("/households/members").send({ userId: otherUser.body.id, role: "ADULT" });
    expect(response.status).toBe(404);
  });

  it("PATCH /members/:id returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    const otherAgent = request.agent(app);
    const otherUser = await otherAgent.post("/users").send({
      name: "No Household",
      email: "patch-member-500@example.com",
      password: "correcthorsebatterystaple",
    });
    await agent.post("/households/members").send({ userId: otherUser.body.id, role: "ADULT" });

    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch(`/households/members/${otherUser.body.id}`).send({ role: "CHILD" });
    expect(response.status).toBe(500);
  });

  it("PATCH /members/:id returns 500 if the target-user lookup itself fails unexpectedly", async () => {
    const { agent, userId } = await createAuthenticatedAgent();
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    vi.spyOn(prisma.user, "findUnique")
      .mockResolvedValueOnce(currentUser as any)
      .mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch("/households/members/999998").send({ role: "ADULT" });
    expect(response.status).toBe(500);
  });

  it("PATCH /members/:id returns 404 if the target user was deleted between the check and the update (race condition)", async () => {
    const { agent } = await createAuthenticatedAgent();
    const otherAgent = request.agent(app);
    const otherUser = await otherAgent.post("/users").send({
      name: "No Household",
      email: "patch-member-race@example.com",
      password: "correcthorsebatterystaple",
    });
    await agent.post("/households/members").send({ userId: otherUser.body.id, role: "ADULT" });

    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.patch(`/households/members/${otherUser.body.id}`).send({ role: "CHILD" });
    expect(response.status).toBe(404);
  });

  it("DELETE /members/:id returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    const otherAgent = request.agent(app);
    const otherUser = await otherAgent.post("/users").send({
      name: "No Household",
      email: "delete-member-500@example.com",
      password: "correcthorsebatterystaple",
    });
    await agent.post("/households/members").send({ userId: otherUser.body.id, role: "ADULT" });

    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete(`/households/members/${otherUser.body.id}`);
    expect(response.status).toBe(500);
  });

  it("DELETE /members/:id returns 500 if the target-user lookup itself fails unexpectedly", async () => {
    const { agent, userId } = await createAuthenticatedAgent();
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    vi.spyOn(prisma.user, "findUnique")
      .mockResolvedValueOnce(currentUser as any)
      .mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete("/households/members/999998");
    expect(response.status).toBe(500);
  });

  it("DELETE /members/:id returns 404 if the target user was deleted between the check and the update (race condition)", async () => {
    const { agent } = await createAuthenticatedAgent();
    const otherAgent = request.agent(app);
    const otherUser = await otherAgent.post("/users").send({
      name: "No Household",
      email: "delete-member-race@example.com",
      password: "correcthorsebatterystaple",
    });
    await agent.post("/households/members").send({ userId: otherUser.body.id, role: "ADULT" });

    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.delete(`/households/members/${otherUser.body.id}`);
    expect(response.status).toBe(404);
  });

  it("POST /dependents returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    vi.spyOn(prisma.dependent, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/households/dependents").send({ name: "Kid1" });
    expect(response.status).toBe(500);
  });

  it("PATCH /dependents/:id returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    vi.spyOn(prisma.dependent, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch(`/households/dependents/${created.body.id}`).send({ name: "Kiddo" });
    expect(response.status).toBe(500);
  });

  it("PATCH /dependents/:id returns 500 if the dependent lookup itself fails unexpectedly", async () => {
    const { agent } = await createAuthenticatedAgent();
    vi.spyOn(prisma.dependent, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch("/households/dependents/1").send({ name: "Kiddo" });
    expect(response.status).toBe(500);
  });

  it("PATCH /dependents/:id returns 404 if the dependent was removed between the check and the update (race condition)", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    vi.spyOn(prisma.dependent, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.patch(`/households/dependents/${created.body.id}`).send({ name: "Kiddo" });
    expect(response.status).toBe(404);
  });

  it("DELETE /dependents/:id returns 500 on an unexpected database error", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    vi.spyOn(prisma.dependent, "delete").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete(`/households/dependents/${created.body.id}`);
    expect(response.status).toBe(500);
  });

  it("DELETE /dependents/:id returns 404 if the dependent was already removed (race condition)", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    vi.spyOn(prisma.dependent, "delete").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.delete(`/households/dependents/${created.body.id}`);
    expect(response.status).toBe(404);
  });
});
