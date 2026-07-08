import express from "express";
import { errorHandler } from "./middleware.js";
import expensesRouter from "./routes/expenses.js";
import cateoriesRouter from "./routes/categories.js";

// Create an instance of the Express application, representing the server.
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.send("OK");
});

app.use("/expenses", expensesRouter);

app.use("/categories", cateoriesRouter);

app.use(errorHandler);

// Start the server and listen on port 3000.
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
