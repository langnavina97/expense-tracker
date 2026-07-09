import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app.js";

describe("categories routes", () => {
  it("POST /categories creates a category", async () => {
    const response = await request(app).post("/categories").send({ name: "Food" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Food" });
    expect(response.body.id).toBeTypeOf("number");
  });

  it("POST /categories fails without a name", async () => {
    const response = await request(app).post("/categories").send({});

    expect(response.status).toBe(400);
  });

  it("POST /categories fails on a duplicate name", async () => {
    await request(app).post("/categories").send({ name: "Food" });
    const response = await request(app).post("/categories").send({ name: "Food" });

    expect(response.status).toBe(409);
  });

  it("GET /categories lists created categories", async () => {
    await request(app).post("/categories").send({ name: "Food" });
    await request(app).post("/categories").send({ name: "Travel" });

    const response = await request(app).get("/categories");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it("GET /categories/:id returns the category", async () => {
    const created = await request(app).post("/categories").send({ name: "Food" });

    const response = await request(app).get(`/categories/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.body.id, name: "Food" });
  });

  it("GET /categories/:id returns 404 for a nonexistent id", async () => {
    const response = await request(app).get("/categories/999999");

    expect(response.status).toBe(404);
  });

  it("GET /categories/:id returns 400 for a non-numeric id", async () => {
    const response = await request(app).get("/categories/not-a-number");

    expect(response.status).toBe(400);
  });

  it("DELETE /categories/:id removes the category", async () => {
    const created = await request(app).post("/categories").send({ name: "Food" });

    const deleteResponse = await request(app).delete(`/categories/${created.body.id}`);
    expect(deleteResponse.status).toBe(200);

    const getResponse = await request(app).get(`/categories/${created.body.id}`);
    expect(getResponse.status).toBe(404);
  });

  it("DELETE /categories/:id returns 404 for a nonexistent id", async () => {
    const response = await request(app).delete("/categories/999999");

    expect(response.status).toBe(404);
  });

  it("PATCH /categories/:id renames the category", async () => {
    const created = await request(app).post("/categories").send({ name: "Food" });

    const response = await request(app)
      .patch(`/categories/${created.body.id}`)
      .send({ name: "Groceries" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Groceries");
  });

  it("PATCH /categories/:id returns 404 for a nonexistent id", async () => {
    const response = await request(app).patch("/categories/999999").send({ name: "Groceries" });

    expect(response.status).toBe(404);
  });

  it("PATCH /categories/:id fails renaming to an empty string", async () => {
    const created = await request(app).post("/categories").send({ name: "Food" });

    const response = await request(app)
      .patch(`/categories/${created.body.id}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
  });

  it("PATCH /categories/:id fails renaming to a name that already exists", async () => {
    await request(app).post("/categories").send({ name: "Food" });
    const created = await request(app).post("/categories").send({ name: "Travel" });

    const response = await request(app)
      .patch(`/categories/${created.body.id}`)
      .send({ name: "Food" });

    expect(response.status).toBe(409);
  });
});
