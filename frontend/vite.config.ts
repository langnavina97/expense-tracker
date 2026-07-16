import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In dev, the API runs separately on :3000 (via `npm run dev` at the repo
// root). Proxying it through Vite means the frontend can use plain relative
// paths ("/expenses", "/auth/google", ...) that work unchanged in
// production, where Express serves both the API and the built frontend from
// the same origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/users": "http://localhost:3000",
      "/households": "http://localhost:3000",
      "/categories": "http://localhost:3000",
      "/expenses": "http://localhost:3000",
      "/auth": "http://localhost:3000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
