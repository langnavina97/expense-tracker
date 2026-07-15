import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { createAuthenticatedAgent } from "../helpers.js";

let agent: Awaited<ReturnType<typeof createAuthenticatedAgent>>["agent"];

beforeEach(async () => {
  ({ agent } = await createAuthenticatedAgent());
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
    const created = await agent.post("/categories").send({ name: "Food" });
    vi.spyOn(prisma.category, "update").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.patch(`/categories/${created.body.id}`).send({ name: "Groceries" });
    expect(response.status).toBe(500);
  });

  it("DELETE /:id returns 500 on an unexpected database error", async () => {
    const created = await agent.post("/categories").send({ name: "Food" });
    vi.spyOn(prisma.category, "delete").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete(`/categories/${created.body.id}`);
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 404 if the row was deleted between the existence check and the update (race condition)", async () => {
    const created = await agent.post("/categories").send({ name: "Food" });
    vi.spyOn(prisma.category, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.patch(`/categories/${created.body.id}`).send({ name: "Groceries" });
    expect(response.status).toBe(404);
  });

  it("DELETE /:id returns 404 if the row was already deleted between the existence check and the delete (race condition)", async () => {
    const created = await agent.post("/categories").send({ name: "Food" });
    vi.spyOn(prisma.category, "delete").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" })
    );
    const response = await agent.delete(`/categories/${created.body.id}`);
    expect(response.status).toBe(404);
  });
});
