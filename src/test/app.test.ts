import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { createAuthenticatedAgent } from "./helpers.js";

describe("GET /health", () => {
  it("returns OK", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });
});

describe("requireAuth", () => {
  it("rejects a request to a protected route with no session", async () => {
    const response = await request(app).get("/expenses");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication required.");
  });

  it("allows a request to a protected route once authenticated", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.get("/expenses");

    expect(response.status).toBe(200);
  });
});
