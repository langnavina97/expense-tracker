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

  it("POST /members refuses to reassign someone who already belongs to another household", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    // This user is the LEAD of their own, separate household.
    const { agent: otherLeadAgent, userId: otherLeadUserId } = await registerAndLoginNoHousehold("otherlead@example.com");
    await otherLeadAgent.post("/households").send({ name: "Their Own Household" });

    const response = await leadAgent.post("/households/members").send({ userId: otherLeadUserId, role: "ADULT" });

    expect(response.status).toBe(409);

    // Confirm they weren't actually moved - still LEAD of their own household.
    const stillTheirs = await otherLeadAgent.get("/users/me");
    expect(stillTheirs.body.role).toBe("LEAD");
  });

  it("PATCH /members/:id changes an existing member's role", async () => {
    const { agent: leadAgent, householdId } = await createAuthenticatedAgent();
    const { userId: otherUserId } = await registerAndLoginNoHousehold("promote@example.com");
    await leadAgent.post("/households/members").send({ userId: otherUserId, role: "CHILD" });

    const response = await leadAgent.patch(`/households/members/${otherUserId}`).send({ role: "ADULT" });

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("ADULT");
    expect(response.body.householdId).toBe(householdId);
  });

  it("PATCH /members/:id fails if the caller doesn't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("nohousehold3@example.com");

    const response = await agent.patch("/households/members/1").send({ role: "ADULT" });

    expect(response.status).toBe(400);
  });

  it("PATCH /members/:id fails if the caller isn't LEAD", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { agent: otherAgent, userId: otherUserId } = await registerAndLoginNoHousehold("nonlead@example.com");
    await leadAgent.post("/households/members").send({ userId: otherUserId, role: "ADULT" });

    const response = await otherAgent.patch(`/households/members/${otherUserId}`).send({ role: "CHILD" });

    expect(response.status).toBe(403);
  });

  it("PATCH /members/:id fails with a missing or invalid role", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { userId: otherUserId } = await registerAndLoginNoHousehold("badrole2@example.com");
    await leadAgent.post("/households/members").send({ userId: otherUserId, role: "ADULT" });

    const response = await leadAgent.patch(`/households/members/${otherUserId}`).send({ role: "MANAGER" });

    expect(response.status).toBe(400);
  });

  it("PATCH /members/:id fails if the lead tries to change their own role", async () => {
    const { agent: leadAgent, userId: leadUserId } = await createAuthenticatedAgent();

    const response = await leadAgent.patch(`/households/members/${leadUserId}`).send({ role: "ADULT" });

    expect(response.status).toBe(400);
  });

  it("PATCH /members/:id fails for a user not in the caller's household", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { userId: outsiderId } = await registerAndLoginNoHousehold("outsider@example.com");

    const response = await leadAgent.patch(`/households/members/${outsiderId}`).send({ role: "ADULT" });

    expect(response.status).toBe(404);
  });

  it("PATCH /members/:id fails for a nonexistent user", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();

    const response = await leadAgent.patch("/households/members/999999").send({ role: "ADULT" });

    expect(response.status).toBe(404);
  });

  it("DELETE /members/:id removes a member from the household", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { agent: otherAgent, userId: otherUserId } = await registerAndLoginNoHousehold("removeme@example.com");
    await leadAgent.post("/households/members").send({ userId: otherUserId, role: "ADULT" });

    const response = await leadAgent.delete(`/households/members/${otherUserId}`);

    expect(response.status).toBe(200);

    const removedView = await otherAgent.get("/users/me");
    expect(removedView.body.householdId).toBeNull();
    expect(removedView.body.role).toBeNull();
  });

  it("DELETE /members/:id fails if the caller doesn't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("nohousehold4@example.com");

    const response = await agent.delete("/households/members/1");

    expect(response.status).toBe(400);
  });

  it("DELETE /members/:id fails if the caller isn't LEAD", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { agent: otherAgent, userId: otherUserId } = await registerAndLoginNoHousehold("nonlead2@example.com");
    await leadAgent.post("/households/members").send({ userId: otherUserId, role: "ADULT" });

    const response = await otherAgent.delete(`/households/members/${otherUserId}`);

    expect(response.status).toBe(403);
  });

  it("DELETE /members/:id fails if the lead tries to remove themselves", async () => {
    const { agent: leadAgent, userId: leadUserId } = await createAuthenticatedAgent();

    const response = await leadAgent.delete(`/households/members/${leadUserId}`);

    expect(response.status).toBe(400);
  });

  it("DELETE /members/:id fails for a user not in the caller's household", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const { userId: outsiderId } = await registerAndLoginNoHousehold("outsider2@example.com");

    const response = await leadAgent.delete(`/households/members/${outsiderId}`);

    expect(response.status).toBe(404);
  });

  it("DELETE /members/:id fails for a nonexistent user", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();

    const response = await leadAgent.delete("/households/members/999999");

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

  it("PATCH /dependents/:id renames a dependent", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    const response = await agent.patch(`/households/dependents/${created.body.id}`).send({ name: "Kiddo" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Kiddo");
  });

  it("PATCH /dependents/:id fails if the caller doesn't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("nohousehold5@example.com");

    const response = await agent.patch("/households/dependents/1").send({ name: "Kiddo" });

    expect(response.status).toBe(400);
  });

  it("PATCH /dependents/:id fails when the caller is a CHILD", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const created = await leadAgent.post("/households/dependents").send({ name: "Kid1" });
    const { agent: childAgent, userId: childUserId } = await registerAndLoginNoHousehold("child2@example.com");
    await leadAgent.post("/households/members").send({ userId: childUserId, role: "CHILD" });

    const response = await childAgent.patch(`/households/dependents/${created.body.id}`).send({ name: "Kiddo" });

    expect(response.status).toBe(403);
  });

  it("PATCH /dependents/:id fails without a name", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    const response = await agent.patch(`/households/dependents/${created.body.id}`).send({});

    expect(response.status).toBe(400);
  });

  it("PATCH /dependents/:id fails for a dependent in a different household", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const created = await leadAgent.post("/households/dependents").send({ name: "Kid1" });
    const { agent: otherLeadAgent } = await registerAndLoginNoHousehold("otherhousehold@example.com");
    await otherLeadAgent.post("/households").send({ name: "Other Household" });

    const response = await otherLeadAgent.patch(`/households/dependents/${created.body.id}`).send({ name: "Kiddo" });

    expect(response.status).toBe(404);
  });

  it("PATCH /dependents/:id fails for a nonexistent dependent", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.patch("/households/dependents/999999").send({ name: "Kiddo" });

    expect(response.status).toBe(404);
  });

  it("DELETE /dependents/:id removes a dependent", async () => {
    const { agent } = await createAuthenticatedAgent();
    const created = await agent.post("/households/dependents").send({ name: "Kid1" });

    const response = await agent.delete(`/households/dependents/${created.body.id}`);

    expect(response.status).toBe(200);

    const household = await agent.get("/households");
    expect(household.body.dependents).toHaveLength(0);
  });

  it("DELETE /dependents/:id fails if the caller doesn't belong to a household", async () => {
    const { agent } = await registerAndLoginNoHousehold("nohousehold6@example.com");

    const response = await agent.delete("/households/dependents/1");

    expect(response.status).toBe(400);
  });

  it("DELETE /dependents/:id fails when the caller is a CHILD", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const created = await leadAgent.post("/households/dependents").send({ name: "Kid1" });
    const { agent: childAgent, userId: childUserId } = await registerAndLoginNoHousehold("child3@example.com");
    await leadAgent.post("/households/members").send({ userId: childUserId, role: "CHILD" });

    const response = await childAgent.delete(`/households/dependents/${created.body.id}`);

    expect(response.status).toBe(403);
  });

  it("DELETE /dependents/:id fails for a dependent in a different household", async () => {
    const { agent: leadAgent } = await createAuthenticatedAgent();
    const created = await leadAgent.post("/households/dependents").send({ name: "Kid1" });
    const { agent: otherLeadAgent } = await registerAndLoginNoHousehold("otherhousehold2@example.com");
    await otherLeadAgent.post("/households").send({ name: "Other Household" });

    const response = await otherLeadAgent.delete(`/households/dependents/${created.body.id}`);

    expect(response.status).toBe(404);
  });

  it("DELETE /dependents/:id fails for a nonexistent dependent", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.delete("/households/dependents/999999");

    expect(response.status).toBe(404);
  });
});
