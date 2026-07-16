import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    // Integration tests share one physical test database with no per-test
    // transaction isolation, so files can't safely run concurrently -
    // one file's cleanup would wipe data another file just created.
    fileParallelism: false,
    // Without this, Vitest's default glob also picks up the frontend's own
    // test suite (a separate project with its own config/environment),
    // which fails immediately since this config has no jsdom environment.
    exclude: ["**/node_modules/**", "frontend/**"],
  },
});
