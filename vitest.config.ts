import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    // Integration tests share one physical test database with no per-test
    // transaction isolation, so files can't safely run concurrently -
    // one file's cleanup would wipe data another file just created.
    fileParallelism: false,
  },
});
