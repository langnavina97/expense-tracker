import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";

afterEach(() => {
  delete process.env.FRONTEND_DIST_PATH;
  vi.resetModules();
});

describe("serving the built frontend", () => {
  it("registers no static/catch-all routes when the frontend hasn't been built", async () => {
    process.env.FRONTEND_DIST_PATH = path.join(os.tmpdir(), `nonexistent-frontend-dist-${Date.now()}`);
    vi.resetModules();
    const { app } = await import("../app.js");

    const response = await request(app).get("/this-route-does-not-exist");
    expect(response.status).toBe(404);
  });

  it("serves index.html for unmatched routes once the frontend has been built", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-dist-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>App</title>");
    process.env.FRONTEND_DIST_PATH = dir;
    vi.resetModules();
    const { app } = await import("../app.js");

    const response = await request(app).get("/some-client-route");

    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>App</title>");

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
