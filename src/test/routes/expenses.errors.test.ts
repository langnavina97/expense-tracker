import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "../../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { createAuthenticatedAgent } from "../helpers.js";

vi.mock("../../exchangeRate.js", () => ({
  getExchangeRate: vi.fn().mockResolvedValue(100),
}));

let agent: Awaited<ReturnType<typeof createAuthenticatedAgent>>["agent"];
let userId: number;
let spenderId: number;
let householdId: number;

beforeEach(async () => {
  ({ agent, userId, spenderId, householdId } = await createAuthenticatedAgent());
});

afterEach(() => {
  vi.restoreAllMocks();
});

const validExpense = () => ({
  title: "Tacos",
  categoryId: 1,
  spenderIds: [spenderId],
  currency: "MXN",
  amount: 1500,
  date: "2026-07-08",
});

const fakeExistingExpense = () => ({
  id: 1,
  title: "Tacos",
  categoryId: 1,
  currency: "MXN",
  amount: 1500,
  convertedAmount: 100,
  date: new Date("2026-07-08"),
  createdByUserId: userId,
  householdId,
});

describe("expenses routes - unexpected database errors fall through to the generic error handler", () => {
  it("POST /suggest-category returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.category, "findMany").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/expenses/suggest-category").send({ title: "Tacos" });
    expect(response.status).toBe(500);
  });

  it("POST / returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.expense, "create").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.post("/expenses").send(validExpense());
    expect(response.status).toBe(500);
  });

  it("GET / returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.expense, "findMany").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/expenses");
    expect(response.status).toBe(500);
  });

  it("GET /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.expense, "findUnique").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.get("/expenses/1");
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.expense, "findUnique").mockResolvedValueOnce(fakeExistingExpense() as any);
    vi.spyOn(prisma.expense, "update").mockRejectedValueOnce(new Error("db down"));

    const response = await agent.patch("/expenses/1").send({ amount: 2000 });
    expect(response.status).toBe(500);
  });

  it("DELETE /:id returns 500 on an unexpected database error", async () => {
    vi.spyOn(prisma.expense, "findUnique").mockResolvedValueOnce(fakeExistingExpense() as any);
    vi.spyOn(prisma.expense, "delete").mockRejectedValueOnce(new Error("db down"));
    const response = await agent.delete("/expenses/1");
    expect(response.status).toBe(500);
  });

  it("PATCH /:id returns 404 if the row was deleted between the existence check and the update (race condition)", async () => {
    vi.spyOn(prisma.expense, "findUnique").mockResolvedValueOnce(fakeExistingExpense() as any);
    vi.spyOn(prisma.expense, "update").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      })
    );

    const response = await agent.patch("/expenses/1").send({ amount: 2000 });
    expect(response.status).toBe(404);
  });

  it("DELETE /:id returns 404 if the row was already deleted between the existence check and the delete (race condition)", async () => {
    vi.spyOn(prisma.expense, "findUnique").mockResolvedValueOnce(fakeExistingExpense() as any);
    vi.spyOn(prisma.expense, "delete").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      })
    );

    const response = await agent.delete("/expenses/1");
    expect(response.status).toBe(404);
  });
});
