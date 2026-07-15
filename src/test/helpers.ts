import request from "supertest";
import { app } from "../app.js";

let callCount = 0;

// Registers a throwaway user, logs in, and creates a household (making the
// user its LEAD) - returns a supertest agent carrying the session cookie,
// plus the user's own id/spenderId, since most protected routes now need
// household context to do anything useful.
//
// The email must be unique per call, not just per test - some tests call
// this twice (e.g. to get a second household to test cross-household
// isolation), and a duplicate email would fail registration silently
// (spenderId would come back undefined).
export async function createAuthenticatedAgent() {
  const agent = request.agent(app);
  const email = `auth-helper-${++callCount}@example.com`;
  const password = "correcthorsebatterystaple";

  const registerResponse = await agent.post("/users").send({ name: "Auth Helper", email, password });
  await agent.post("/users/login").send({ email, password });
  const householdResponse = await agent.post("/households").send({ name: "Auth Helper Household" });

  return {
    agent,
    userId: registerResponse.body.id as number,
    spenderId: registerResponse.body.spenderId as number,
    householdId: householdResponse.body.id as number,
  };
}
