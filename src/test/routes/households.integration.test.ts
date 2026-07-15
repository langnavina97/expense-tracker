import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { createAuthenticatedAgent } from "../helpers.js";

// Registers and logs in a fresh user, without creating a household -
// useful for testing the "not in a household yet" and "add a member" paths.
async function registerAndLoginNoHousehold(email: string) {
  const agent = request.agent(app);
  const password = "correcthorsebatterystaple";
  const registerResponse = await agent.post("/users").send({ name: "No Household User", email, password });
  await agent.post("/users/login").send({ email, password });
  return { agent, userId: registerResponse.body.id as number };
}

describe("households routes", () => {
  it("POST / creates a household and makes the creator LEAD", async () => {
    const { agent } = await registerAndLoginNoHousehold("lead@example.com");

    const response = await agent.post("/households").send({ name: "The Langs" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "The Langs" });

    const me = await agent.get("/users").then((r) => r.body[0]);
    expect(me.role).toBe("LEAD");
    expect(me.householdId).toBe(response.body.id);
  });

  it("POST / fails without a name", async () => {
    const { agent } = await registerAndLoginNoHousehold("noname@example.com");

    const response = await agent.post("/households").send({});

    expect(response.status).toBe(400);
  });

  it("POST / fails if you already belong to a household", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.post("/households").send({ name: "Second Household" });

    expect(response.status).toBe(400);
  });

  it("GET / returns the household with members and dependents", async () => {
    const { agent } = await createAuthenticatedAgent();
    await agent.post("/households/dependents").send({ name: "Kid" });

    const response = await agent.get("/households");

    expect(response.status).toBe(200);
    expect(response.body.members).toHaveLength(1);
    expect(response.body.dependents).toHaveLength(1);
  });

  it("GET / fails if you don't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("lonely@example.com");

    const response = await agent.get("/households");

    expect(response.status).toBe(404);
  });

  it("POST /members adds an existing user to the household", async () => {
    const { agent: leadAgent, householdId } = await createAuthenticatedAgent();
    const { agent: otherAgent, userId: otherUserId } = await registerAndLoginNoHousehold("partner@example.com");

    const response = await leadAgent.post("/households/members").send({ userId: otherUserId, role: "ADULT" });

    expect(response.status).toBe(200);
    expect(response.body.householdId).toBe(householdId);
    expect(response.body.role).toBe("ADULT");

    const partnerView = await otherAgent.get("/users").then((r) => r.body.find((u: any) => u.id === otherUserId));
    expect(partnerView.householdId).toBe(householdId);
  });

  it("POST /members fails if the caller doesn't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("nohousehold@example.com");

    const response = await agent.post("/households/members").send({ userId: 1, role: "ADULT" });

    expect(response.status).toBe(400);
  });

  it("POST /members fails if the caller isn't LEAD", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { agent: otherAgent, userId: otherUserId } = await registerAndLoginNoHousehold("adult@example.com");
    await leadAgent.post("/households/members").send({ userId: otherUserId, role: "ADULT" });

    const { userId: thirdUserId } = await registerAndLoginNoHousehold("third@example.com");

    const response = await otherAgent.post("/households/members").send({ userId: thirdUserId, role: "ADULT" });

    expect(response.status).toBe(403);
  });

  it("POST /members fails with a missing or invalid role", async () => {
    const { agent } = await createAuthenticatedAgent();
    const { userId: otherUserId } = await registerAndLoginNoHousehold("badrole@example.com");

    const response = await agent.post("/households/members").send({ userId: otherUserId, role: "MANAGER" });

    expect(response.status).toBe(400);
  });

  it("POST /members fails when userId doesn't exist", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.post("/households/members").send({ userId: 999999, role: "ADULT" });

    expect(response.status).toBe(404);
  });

  it("POST /dependents adds a dependent to the household", async () => {
    const { agent, householdId } = await createAuthenticatedAgent();

    const response = await agent.post("/households/dependents").send({ name: "Kid1" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Kid1", householdId });
  });

  it("POST /dependents fails if the caller doesn't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("nohousehold2@example.com");

    const response = await agent.post("/households/dependents").send({ name: "Kid1" });

    expect(response.status).toBe(400);
  });

  it("POST /dependents fails without a name", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.post("/households/dependents").send({});

    expect(response.status).toBe(400);
  });

  it("POST /dependents fails when the caller is a CHILD", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { agent: childAgent, userId: childUserId } = await registerAndLoginNoHousehold("child@example.com");
    await leadAgent.post("/households/members").send({ userId: childUserId, role: "CHILD" });

    const response = await childAgent.post("/households/dependents").send({ name: "Kid1" });

    expect(response.status).toBe(403);
  });
});
