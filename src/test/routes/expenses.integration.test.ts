import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthenticatedAgent } from "../helpers.js";

vi.mock("../../exchangeRate.js", () => ({
  getExchangeRate: vi.fn().mockResolvedValue(100),
}));

let agent: Awaited<ReturnType<typeof createAuthenticatedAgent>>;
let categoryId: number;

beforeEach(async () => {
  agent = await createAuthenticatedAgent();
  const category = await agent.post("/categories").send({ name: "Food" });
  categoryId = category.body.id;
});

const validExpense = () => ({
  title: "Tacos",
  categoryId,
  spender: "you",
  currency: "MXN",
  amount: 1500,
  date: "2026-07-08",
});

describe("expenses routes", () => {
  it("POST /expenses creates an expense", async () => {
    const response = await agent.post("/expenses").send(validExpense());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ title: "Tacos", categoryId, amount: 1500, convertedAmount: 100 });
  });

  it("POST /expenses fails when a required field is missing", async () => {
    const { spender, ...incomplete } = validExpense();
    const response = await agent.post("/expenses").send(incomplete);

    expect(response.status).toBe(400);
  });

  it("POST /expenses fails with an unsupported currency", async () => {
    const response = await agent.post("/expenses").send({ ...validExpense(), currency: "XYZ" });

    expect(response.status).toBe(400);
  });

  it("POST /expenses fails with a categoryId that doesn't exist", async () => {
    const response = await agent.post("/expenses").send({ ...validExpense(), categoryId: 999999 });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/categoryId/);
  });

  it("GET /expenses lists created expenses", async () => {
    await agent.post("/expenses").send(validExpense());

    const response = await agent.get("/expenses");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it("GET /expenses/:id returns the expense", async () => {
    const created = await agent.post("/expenses").send(validExpense());

    const response = await agent.get(`/expenses/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.body.id, title: "Tacos" });
  });

  it("GET /expenses/:id returns 404 for a nonexistent id", async () => {
    const response = await agent.get("/expenses/999999");

    expect(response.status).toBe(404);
  });

  it("PATCH /expenses/:id fails with an unsupported currency", async () => {
    const created = await agent.post("/expenses").send(validExpense());

    const response = await agent
      .patch(`/expenses/${created.body.id}`)
      .send({ currency: "XYZ" });

    expect(response.status).toBe(400);
  });

  it("PATCH /expenses/:id updates categoryId and date", async () => {
    const created = await agent.post("/expenses").send(validExpense());
    const newCategory = await agent.post("/categories").send({ name: "Travel" });

    const response = await agent
      .patch(`/expenses/${created.body.id}`)
      .send({ categoryId: newCategory.body.id, date: "2026-07-09" });

    expect(response.status).toBe(200);
    expect(response.body.categoryId).toBe(newCategory.body.id);
    expect(response.body.date).toBe("2026-07-09T00:00:00.000Z");
  });

  it("PATCH /expenses/:id returns 404 for a nonexistent id", async () => {
    const response = await agent.patch("/expenses/999999").send({ amount: 2000 });

    expect(response.status).toBe(404);
  });

  it("PATCH /expenses/:id updating only the title leaves convertedAmount untouched", async () => {
    const created = await agent.post("/expenses").send(validExpense());
    expect(created.body.convertedAmount).toBe(100);

    const patched = await agent
      .patch(`/expenses/${created.body.id}`)
      .send({ title: "Tacos al pastor" });

    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe("Tacos al pastor");
    expect(patched.body.convertedAmount).toBe(100); // must not have been nulled out
  });

  it("PATCH /expenses/:id updating only the amount recomputes convertedAmount", async () => {
    const created = await agent.post("/expenses").send(validExpense());

    const patched = await agent
      .patch(`/expenses/${created.body.id}`)
      .send({ amount: 3000 });

    expect(patched.status).toBe(200);
    expect(patched.body.amount).toBe(3000);
    expect(patched.body.convertedAmount).toBe(100); // mocked getExchangeRate always returns 100
  });

  it("DELETE /expenses/:id removes the expense", async () => {
    const created = await agent.post("/expenses").send(validExpense());

    const deleteResponse = await agent.delete(`/expenses/${created.body.id}`);
    expect(deleteResponse.status).toBe(200);

    const getResponse = await agent.get(`/expenses/${created.body.id}`);
    expect(getResponse.status).toBe(404);
  });

  it("DELETE /expenses/:id returns 404 on a second delete", async () => {
    const created = await agent.post("/expenses").send(validExpense());
    await agent.delete(`/expenses/${created.body.id}`);

    const secondDelete = await agent.delete(`/expenses/${created.body.id}`);
    expect(secondDelete.status).toBe(404);
  });
});
