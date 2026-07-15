import request from "supertest";
import { app } from "../app.js";

// Registers a throwaway user and logs in, returning a supertest agent that
// carries the resulting session cookie on every subsequent request. Use this
// wherever a test needs to hit a route protected by requireAuth.
export async function createAuthenticatedAgent() {
  const agent = request.agent(app);
  const email = "auth-helper@example.com";
  const password = "correcthorsebatterystaple";

  await agent.post("/users").send({ name: "Auth Helper", email, password });
  await agent.post("/users/login").send({ email, password });

  return agent;
}
