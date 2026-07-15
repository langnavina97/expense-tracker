import express from "express";
import session from "express-session";
import { errorHandler } from "./middleware.js";
import expensesRouter from "./routes/expenses.js";
import categoriesRouter from "./routes/categories.js";
import usersRouter from "./routes/users.js";
import householdsRouter from "./routes/households.js";

// Create an instance of the Express application, representing the server.
export const app = express();

app.use(express.json());

// Session middleware: creates a session + cookie on first use, reads it back
// on later requests. Uses the default in-memory store, which is fine for
// local dev/learning but not production (lost on restart, doesn't scale
// across multiple server processes) - a real deploy would swap in a
// persistent store (e.g. Postgres- or Redis-backed) here.
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
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

app.use(errorHandler);
