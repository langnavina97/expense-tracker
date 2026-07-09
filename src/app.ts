import express from "express";
import { errorHandler } from "./middleware.js";
import expensesRouter from "./routes/expenses.js";
import categoriesRouter from "./routes/categories.js";

// Create an instance of the Express application, representing the server.
export const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.send("OK");
});

app.use("/expenses", expensesRouter);

app.use("/categories", categoriesRouter);

app.use(errorHandler);
