import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { createAuthenticatedAgent } from "../helpers.js";

vi.mock("../../exchangeRate.js", () => ({
  getExchangeRate: vi.fn().mockResolvedValue(100),
}));

vi.mock("../../categorize.js", () => ({
  suggestCategory: vi.fn(async (title: string, categoryNames: string[]) => {
    if (title.toLowerCase().includes("unavailable")) return undefined;
    return title.toLowerCase().includes("taco") && categoryNames.includes("Food") ? "Food" : null;
  }),
}));

let agent: Awaited<ReturnType<typeof createAuthenticatedAgent>>["agent"];
let spenderId: number;
let categoryId: number;

beforeEach(async () => {
  ({ agent, spenderId } = await createAuthenticatedAgent());
  const category = await agent.post("/categories").send({ name: "Food" });
  categoryId = category.body.id;
});

const validExpense = () => ({
  title: "Tacos",
  categoryId,
  spenderIds: [spenderId],
  currency: "MXN",
  amount: 1500,
  date: "2026-07-08",
});

describe("expenses routes", () => {
  it("POST /expenses/suggest-category returns a matching category", async () => {
    const response = await agent.post("/expenses/suggest-category").send({ title: "Tacos" });

    expect(response.status).toBe(200);
    expect(response.body.suggestedCategory).toMatchObject({ id: categoryId, name: "Food" });
  });

  it("POST /expenses/suggest-category returns null when nothing matches", async () => {
    const response = await agent.post("/expenses/suggest-category").send({ title: "Something obscure" });

    expect(response.status).toBe(200);
    expect(response.body.suggestedCategory).toBeNull();
  });

  it("POST /expenses/suggest-category flags unavailable when the AI call couldn't be completed", async () => {
    const response = await agent.post("/expenses/suggest-category").send({ title: "Unavailable test" });

    expect(response.status).toBe(200);
    expect(response.body.suggestedCategory).toBeNull();
    expect(response.body.unavailable).toBe(true);
  });

  it("POST /expenses/suggest-category fails without a title", async () => {
    const response = await agent.post("/expenses/suggest-category").send({});

    expect(response.status).toBe(400);
  });

  it("POST /expenses/suggest-category returns null when the caller has no household", async () => {
    const noHouseholdAgent = request.agent(app);
    await noHouseholdAgent.post("/users").send({
      name: "No Household",
      email: "no-household-suggest@example.com",
      password: "correcthorsebatterystaple",
    });
    await noHouseholdAgent.post("/users/login").send({
      email: "no-household-suggest@example.com",
      password: "correcthorsebatterystaple",
    });

    const response = await noHouseholdAgent.post("/expenses/suggest-category").send({ title: "Tacos" });

    expect(response.status).toBe(200);
    expect(response.body.suggestedCategory).toBeNull();
  });

  it("POST /expenses creates an expense", async () => {
    const response = await agent.post("/expenses").send(validExpense());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ title: "Tacos", categoryId, amount: 1500, convertedAmount: 100 });
  });

  it("POST /expenses fails when a required field is missing", async () => {
    const { spenderIds, ...incomplete } = validExpense();
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

  it("POST /expenses fails with a spenderId that doesn't exist", async () => {
    const response = await agent.post("/expenses").send({ ...validExpense(), spenderIds: [999999] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/spenderIds/);
  });

  it("POST /expenses fails with a spenderId belonging to a different household", async () => {
    const { agent: otherAgent, spenderId: otherSpenderId } = await createAuthenticatedAgent();

    const response = await agent.post("/expenses").send({ ...validExpense(), spenderIds: [otherSpenderId] });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/household/);
  });

  it("POST /expenses fails if the caller doesn't belong to a household", async () => {
    const noHouseholdAgent = request.agent(app);
    await noHouseholdAgent.post("/users").send({
      name: "No Household",
      email: "no-household-expense@example.com",
      password: "correcthorsebatterystaple",
    });
    await noHouseholdAgent.post("/users/login").send({
      email: "no-household-expense@example.com",
      password: "correcthorsebatterystaple",
    });

    const response = await noHouseholdAgent.post("/expenses").send(validExpense());

    expect(response.status).toBe(400);
  });

  it("GET /expenses returns an empty array if the caller doesn't belong to a household", async () => {
    const noHouseholdAgent = request.agent(app);
    await noHouseholdAgent.post("/users").send({
      name: "No Household",
      email: "no-household-get-expense@example.com",
      password: "correcthorsebatterystaple",
    });
    await noHouseholdAgent.post("/users/login").send({
      email: "no-household-get-expense@example.com",
      password: "correcthorsebatterystaple",
    });

    const response = await noHouseholdAgent.get("/expenses");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
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

  it("PATCH /expenses/:id fails with a spenderId that doesn't exist", async () => {
    const created = await agent.post("/expenses").send(validExpense());

    const response = await agent
      .patch(`/expenses/${created.body.id}`)
      .send({ spenderIds: [999999] });

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

  it("PATCH /expenses/:id updates spenderIds", async () => {
    const created = await agent.post("/expenses").send(validExpense());
    const dependent = await agent.post("/households/dependents").send({ name: "Kid1" });

    const patchResponse = await agent
      .patch(`/expenses/${created.body.id}`)
      .send({ spenderIds: [dependent.body.spenderId] });
    expect(patchResponse.status).toBe(200);

    const getResponse = await agent.get(`/expenses/${created.body.id}`);
    expect(getResponse.body.spenders).toEqual([{ id: dependent.body.spenderId }]);
  });

  it("PATCH /expenses/:id returns 404 for an expense in a different household", async () => {
    const { agent: otherAgent, spenderId: otherSpenderId } = await createAuthenticatedAgent();
    const otherCategory = await otherAgent.post("/categories").send({ name: "Travel" });
    const otherExpense = await otherAgent.post("/expenses").send({
      title: "Other household expense",
      categoryId: otherCategory.body.id,
      spenderIds: [otherSpenderId],
      currency: "USD",
      amount: 100,
      date: "2026-07-08",
    });

    const response = await agent.patch(`/expenses/${otherExpense.body.id}`).send({ amount: 2000 });

    expect(response.status).toBe(404);
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

  it("DELETE /expenses/:id returns 404 for an expense in a different household", async () => {
    const { agent: otherAgent, spenderId: otherSpenderId } = await createAuthenticatedAgent();
    const otherCategory = await otherAgent.post("/categories").send({ name: "Travel" });
    const otherExpense = await otherAgent.post("/expenses").send({
      title: "Other household expense",
      categoryId: otherCategory.body.id,
      spenderIds: [otherSpenderId],
      currency: "USD",
      amount: 100,
      date: "2026-07-08",
    });

    const response = await agent.delete(`/expenses/${otherExpense.body.id}`);

    expect(response.status).toBe(404);
  });

  async function addChildToHousehold() {
    const email = "expense-child@example.com";
    const childAgent = request.agent(app);
    const registerResponse = await childAgent.post("/users").send({
      name: "Child",
      email,
      password: "correcthorsebatterystaple",
    });
    await childAgent.post("/users/login").send({ email, password: "correcthorsebatterystaple" });
    await agent.post("/households/members").send({ userId: registerResponse.body.id, role: "CHILD" });
    return childAgent;
  }

  it("PATCH /expenses/:id returns 403 when a CHILD tries to modify an expense they didn't create", async () => {
    const created = await agent.post("/expenses").send(validExpense());
    const childAgent = await addChildToHousehold();

    const response = await childAgent.patch(`/expenses/${created.body.id}`).send({ amount: 2000 });

    expect(response.status).toBe(403);
  });

  it("DELETE /expenses/:id returns 403 when a CHILD tries to delete an expense they didn't create", async () => {
    const created = await agent.post("/expenses").send(validExpense());
    const childAgent = await addChildToHousehold();

    const response = await childAgent.delete(`/expenses/${created.body.id}`);

    expect(response.status).toBe(403);
  });
});
