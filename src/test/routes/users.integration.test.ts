import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app.js";

const validUser = {
  name: "Test User",
  email: "test@example.com",
  password: "correcthorsebatterystaple",
};

// Registers and logs in as the given user, returning an agent authenticated
// as that same user - keeps user-count assertions accurate (no extra rows
// from a separate "auth helper" identity).
async function registerAndLogin(user: typeof validUser) {
  const agent = request.agent(app);
  await agent.post("/users").send(user);
  await agent.post("/users/login").send({ email: user.email, password: user.password });
  return agent;
}

describe("users routes", () => {
  it("POST /users fails with a missing field", async () => {
    const { password, ...incomplete } = validUser;
    const response = await request(app).post("/users").send(incomplete);

    expect(response.status).toBe(400);
  });

  it("POST /users creates a user without leaking passwordHash", async () => {
    const response = await request(app).post("/users").send(validUser);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Test User", email: "test@example.com" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("POST /users fails on a duplicate email", async () => {
    await request(app).post("/users").send(validUser);
    const response = await request(app).post("/users").send(validUser);

    expect(response.status).toBe(409);
  });

  it("POST /users/login succeeds with correct credentials and sets a session cookie", async () => {
    await request(app).post("/users").send(validUser);

    const response = await request(app)
      .post("/users/login")
      .send({ email: validUser.email, password: validUser.password });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Test User", email: "test@example.com" });
    expect(response.body.passwordHash).toBeUndefined();
    const setCookieHeader = response.headers["set-cookie"];
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader?.[0]).toContain("HttpOnly");
  });

  it("POST /users/login fails with the wrong password", async () => {
    await request(app).post("/users").send(validUser);

    const response = await request(app)
      .post("/users/login")
      .send({ email: validUser.email, password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid email or password.");
  });

  it("POST /users/login fails with a nonexistent email, using the identical message", async () => {
    await request(app).post("/users").send(validUser);

    const wrongPassword = await request(app)
      .post("/users/login")
      .send({ email: validUser.email, password: "wrong-password" });
    const noSuchUser = await request(app)
      .post("/users/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    // Must be indistinguishable - otherwise an attacker can enumerate registered emails.
    expect(noSuchUser.status).toBe(wrongPassword.status);
    expect(noSuchUser.body.error).toBe(wrongPassword.body.error);
  });

  it("GET /users/me returns the current user without leaking passwordHash", async () => {
    const agent = await registerAndLogin(validUser);

    const response = await agent.get("/users/me");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Test User", email: "test@example.com" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("GET /users/me fails when not logged in", async () => {
    const response = await request(app).get("/users/me");

    expect(response.status).toBe(401);
  });

  it("POST /users/logout ends the session", async () => {
    const agent = await registerAndLogin(validUser);

    const logoutResponse = await agent.post("/users/logout");
    expect(logoutResponse.status).toBe(200);

    const meResponse = await agent.get("/users/me");
    expect(meResponse.status).toBe(401);
  });

  it("GET /users lists users without leaking passwordHash", async () => {
    const agent = await registerAndLogin(validUser);

    const response = await agent.get("/users");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].passwordHash).toBeUndefined();
  });

  it("GET /users/:id returns the user without leaking passwordHash", async () => {
    const agent = await registerAndLogin(validUser);
    const me = await agent.get("/users").then((r) => r.body[0]);

    const response = await agent.get(`/users/${me.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Test User" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("GET /users/:id returns 404 for a nonexistent id", async () => {
    const agent = await registerAndLogin(validUser);

    const response = await agent.get("/users/999999");

    expect(response.status).toBe(404);
  });

  it("GET /users/:id returns 404 for a user in a different household", async () => {
    const agent = await registerAndLogin(validUser);
    await agent.post("/households").send({ name: "My Household" });

    const other = await registerAndLogin({ ...validUser, email: "other-household@example.com" });
    await other.post("/households").send({ name: "Other Household" });
    const otherUser = await other.get("/users").then((r) => r.body[0]);

    const response = await agent.get(`/users/${otherUser.id}`);

    expect(response.status).toBe(404);
  });

  it("PATCH /users/:id updates the name", async () => {
    const agent = await registerAndLogin(validUser);
    const me = await agent.get("/users").then((r) => r.body[0]);

    const response = await agent.patch(`/users/${me.id}`).send({ name: "Updated Name" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Name");
  });

  it("PATCH /users/:id fails renaming to an empty name", async () => {
    const agent = await registerAndLogin(validUser);
    const me = await agent.get("/users").then((r) => r.body[0]);

    const response = await agent.patch(`/users/${me.id}`).send({ name: "" });

    expect(response.status).toBe(400);
  });

  it("PATCH /users/:id returns 403 for any id other than your own", async () => {
    const agent = await registerAndLogin(validUser);

    const response = await agent.patch("/users/999999").send({ name: "Someone" });

    expect(response.status).toBe(403);
  });

  it("PATCH /users/:id fails renaming email to one that already exists", async () => {
    await request(app).post("/users").send(validUser);
    const second = { ...validUser, email: "second@example.com" };
    const agent = await registerAndLogin(second);
    const me = await agent.get("/users").then((r) => r.body.find((u: any) => u.email === second.email));

    const response = await agent.patch(`/users/${me.id}`).send({ email: validUser.email });

    expect(response.status).toBe(409);
  });

  it("DELETE /users/:id removes the user, invalidating their own session", async () => {
    const agent = await registerAndLogin(validUser);
    const me = await agent.get("/users").then((r) => r.body[0]);

    const deleteResponse = await agent.delete(`/users/${me.id}`);
    expect(deleteResponse.status).toBe(200);

    // The session's userId no longer resolves to a real user, so requireAuth
    // now correctly rejects it as unauthenticated, not "not found".
    const getResponse = await agent.get(`/users/${me.id}`);
    expect(getResponse.status).toBe(401);
  });

  it("DELETE /users/:id returns 403 for any id other than your own", async () => {
    const agent = await registerAndLogin(validUser);

    const response = await agent.delete("/users/999999");

    expect(response.status).toBe(403);
  });
});
