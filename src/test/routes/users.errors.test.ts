import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { createAuthenticatedAgent } from "../helpers.js";

let agent: Awaited<ReturnType<typeof createAuthenticatedAgent>>["agent"];
let userId: number;

beforeEach(async () => {
  ({ agent, userId } = await createAuthenticatedAgent());
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
    // requireAuth itself calls findUnique first (to load the current user),
    // so the mock must let that call through and only fail the route
    // handler's own lookup - the second call.
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    vi.spyOn(prisma.user, "findUnique")
      .mockResolvedValueOnce(currentUser as any)
      .mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get(`/users/${userId}`);
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch(`/users/${userId}`).send({ name: "Someone" });
    expect(response.status).toBe(500);
  });

  it("DELETE /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.user, "delete").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete(`/users/${userId}`);
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 404 if the row was deleted between requests (race condition)", async () => {
    vi.spyOn(prisma.user, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.patch(`/users/${userId}`).send({ name: "Someone" });
    expect(response.status).toBe(404);
  });

  it("DELETE /:id returns 404 if the row was already deleted (race condition)", async () => {
    vi.spyOn(prisma.user, "delete").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.delete(`/users/${userId}`);
    expect(response.status).toBe(404);
  });
});
