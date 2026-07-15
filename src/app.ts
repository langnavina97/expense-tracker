import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { errorHandler } from "./middleware.js";
import expensesRouter from "./routes/expenses.js";
import categoriesRouter from "./routes/categories.js";
import usersRouter from "./routes/users.js";
import householdsRouter from "./routes/households.js";
import googleAuthRouter from "./routes/googleAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create an instance of the Express application, representing the server.
export const app = express();

// Render (and most PaaS hosts) put the app behind a reverse proxy - this
// tells Express to trust the proxy's headers, which secure cookies need to
// work correctly (otherwise Express thinks every request is plain HTTP).
app.set("trust proxy", 1);

app.use(express.json());

// Session middleware: creates a session + cookie on first use, reads it back
// on later requests. Backed by Postgres (via connect-pg-simple) instead of
// the default in-memory store, which loses every session on restart and
// isn't safe for production. createTableIfMissing sets up its own "session"
// table automatically - this is infrastructure the session library owns,
// not part of our own Prisma schema/migrations.
const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({ pool: sessionPool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // allows the cookie through Google's redirect back to our callback
    },
  })
);

app.get("/health", (req, res) => {
  res.send("OK");
});

app.use("/expenses", expensesRouter);

app.use("/categories", categoriesRouter);

app.use("/users", usersRouter);

app.use("/households", householdsRouter);

app.use("/auth", googleAuthRouter);

// Serve the built frontend (frontend/dist) from the same origin as the API,
// so production is a single deploy. Only registered if that build actually
// exists - locally, the frontend is served separately by Vite's dev server.
const frontendDist = process.env.FRONTEND_DIST_PATH || path.join(__dirname, "../frontend/dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // Anything not matched by an API route above is a client-side route -
  // hand it index.html and let React Router take over.
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);
