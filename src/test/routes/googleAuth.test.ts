import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { prisma } from "../../prisma.js";

let capturedState = "";
const generateAuthUrlMock = vi.fn((opts: any) => {
  capturedState = opts.state;
  return "https://accounts.google.com/mock-consent";
});
const getTokenMock = vi.fn();
const verifyIdTokenMock = vi.fn();

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return {
      generateAuthUrl: generateAuthUrlMock,
      getToken: getTokenMock,
      verifyIdToken: verifyIdTokenMock,
    };
  }),
}));

const { app } = await import("../../app.js");

afterEach(() => {
  getTokenMock.mockReset();
  verifyIdTokenMock.mockReset();
});

// Simulates the browser's first hop: visit /auth/google, capture the
// session-carrying agent and the state Google would echo back on callback.
async function startFlow() {
  const agent = request.agent(app);
  const response = await agent.get("/auth/google");
  return { agent, state: capturedState, response };
}

function mockGoogleUser(overrides: Partial<{ email: string; name: string; sub: string }> = {}) {
  getTokenMock.mockResolvedValueOnce({ tokens: { id_token: "fake-id-token" } });
  verifyIdTokenMock.mockResolvedValueOnce({
    getPayload: () => ({
      email: overrides.email ?? "googleuser@example.com",
      name: overrides.name ?? "Google User",
      sub: overrides.sub ?? "google-sub-123",
    }),
  });
}

describe("GET /auth/google", () => {
  it("redirects to Google's consent screen and stashes a state in the session", async () => {
    const { response, state } = await startFlow();

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://accounts.google.com/mock-consent");
    expect(state).toBeTruthy();
  });
});

describe("GET /auth/google/callback", () => {
  it("fails with 400 if state is missing", async () => {
    const { agent } = await startFlow();

    const response = await agent.get("/auth/google/callback").query({ code: "abc" });

    expect(response.status).toBe(400);
  });

  it("fails with 400 if state doesn't match the session's", async () => {
    const { agent } = await startFlow();

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state: "wrong-state" });

    expect(response.status).toBe(400);
  });

  it("fails with 400 if code is missing", async () => {
    const { agent, state } = await startFlow();

    const response = await agent.get("/auth/google/callback").query({ state });

    expect(response.status).toBe(400);
  });

  it("fails with 400 if Google doesn't return an identity token", async () => {
    const { agent, state } = await startFlow();
    getTokenMock.mockResolvedValueOnce({ tokens: {} });

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(400);
  });

  it("fails with 400 if the verified token has no email", async () => {
    const { agent, state } = await startFlow();
    getTokenMock.mockResolvedValueOnce({ tokens: { id_token: "fake-id-token" } });
    verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => ({ sub: "google-sub-123" }) });

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(400);
  });

  it("creates a new user on first Google login and logs them in", async () => {
    const { agent, state } = await startFlow();
    mockGoogleUser({ email: "newgoogleuser@example.com", name: "New Google User" });

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email: "newgoogleuser@example.com", name: "New Google User" });
    expect(response.body.googleId).toBe("google-sub-123");
    expect(response.body.passwordHash).toBeUndefined();

    // Confirm the session was actually established.
    const usersResponse = await agent.get("/users");
    expect(usersResponse.status).toBe(200);
  });

  it("falls back to the email as the name when Google doesn't provide one", async () => {
    const { agent, state } = await startFlow();
    getTokenMock.mockResolvedValueOnce({ tokens: { id_token: "fake-id-token" } });
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({ email: "noname@example.com", sub: "google-sub-noname" }),
    });

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("noname@example.com");
  });

  it("links an existing password-based account with the same email instead of duplicating it", async () => {
    const passwordAgent = request.agent(app);
    const registerResponse = await passwordAgent.post("/users").send({
      name: "Existing User",
      email: "existing@example.com",
      password: "correcthorsebatterystaple",
    });

    const { agent, state } = await startFlow();
    mockGoogleUser({ email: "existing@example.com" });

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(registerResponse.body.id);
    expect(response.body.googleId).toBe("google-sub-123");
  });

  it("logs an already-linked Google account back in without re-updating it", async () => {
    const first = await startFlow();
    mockGoogleUser({ email: "returning@example.com", sub: "google-sub-returning" });
    const firstResponse = await first.agent.get("/auth/google/callback").query({ code: "abc", state: first.state });

    const second = await startFlow();
    mockGoogleUser({ email: "returning@example.com", sub: "google-sub-returning" });
    const secondResponse = await second.agent
      .get("/auth/google/callback")
      .query({ code: "abc", state: second.state });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.id).toBe(firstResponse.body.id);
    expect(secondResponse.body.googleId).toBe("google-sub-returning");
  });

  it("rejects a login for a soft-deleted account", async () => {
    // The API's own DELETE anonymizes the email away, so a soft-deleted
    // account can never be matched by email through the public API alone -
    // set deletedAt directly to exercise this defense-in-depth check.
    const registerResponse = await request(app).post("/users").send({
      name: "Deleted User",
      email: "deleted-google@example.com",
      password: "correcthorsebatterystaple",
    });
    await prisma.user.update({
      where: { id: registerResponse.body.id },
      data: { deletedAt: new Date() },
    });

    const { agent, state } = await startFlow();
    mockGoogleUser({ email: "deleted-google@example.com" });

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(401);
  });

  it("returns 500 on an unexpected error", async () => {
    const { agent, state } = await startFlow();
    getTokenMock.mockRejectedValueOnce(new Error("network down"));

    const response = await agent.get("/auth/google/callback").query({ code: "abc", state });

    expect(response.status).toBe(500);
  });
});

describe("module load", () => {
  it("throws immediately if a Google OAuth environment variable isn't set", async () => {
    const original = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    vi.resetModules();

    await expect(import("../../routes/googleAuth.js")).rejects.toThrow(
      "Google OAuth environment variables are not set"
    );

    process.env.GOOGLE_CLIENT_ID = original;
    vi.resetModules();
  });
});
