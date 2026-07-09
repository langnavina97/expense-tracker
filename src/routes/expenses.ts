import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireValidId } from "../middleware.js";
import { Prisma } from "../generated/prisma/client.js";
import { getExchangeRate } from "../exchangeRate.js";

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "MXN", "GBP", "JPY", "CAD", "CHF"];

// Shared body validation for POST (partial: false) and PATCH (partial: true).
// Returns an error message string, or null if valid.
export function validateExpenseInput(
  body: any,
  { partial }: { partial: boolean }
): string | null {
  const { categoryId, spender, currency, amount, date } = body;

  if (!partial && (!spender || !currency || amount == null || !date || categoryId == null)) {
    return "categoryId, spender, currency, amount, and date are required.";
  }

  if (currency !== undefined && !SUPPORTED_CURRENCIES.includes(currency)) {
    return `Unsupported currency: ${currency}`;
  }

  return null;
}

const router = Router();

router.post("/", async (req, res, next) => {
  const { title, categoryId, spender, currency, amount, convertedAmount, date } = req.body;

  const validationError = validateExpenseInput(req.body, { partial: false });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    // Create a new expense record in the database using Prisma.
    const expense = await prisma.expense.create({
      data: {
        title,
        category: { connect: { id: categoryId } },
        spender,
        currency,
        amount,
        convertedAmount: await getExchangeRate(currency, "USD", amount), // Convert to USD using the exchange rate function
        date: new Date(date),  // req.body.date arrives as a string, Prisma needs a Date object
      },
    });

    // Respond with the created expense record.
    res.status(201).json(expense);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(400).json({ error: "categoryId does not exist." });
    }
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    // Fetch all expense records from the database using Prisma.
    const expenses = await prisma.expense.findMany();

    // Respond with the list of expenses.
    res.status(200).json(expenses);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireValidId, async (req, res, next) => {
  const id = res.locals.id;

  try {
    // Fetch a specific expense record by ID from the database using Prisma.
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return res.status(404).json({ error: "Expense not found." });
    }

    // Respond with the found expense record.
    res.status(200).json(expense);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireValidId, async (req, res, next) => {
  const id = res.locals.id;
  const { title, categoryId, spender, currency, amount, convertedAmount, date } = req.body;

  const validationError = validateExpenseInput(req.body, { partial: true });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const existingExpense = await prisma.expense.findUnique({ where: { id } });
    if (!existingExpense) {
      return res.status(404).json({ error: "Expense not found." });
    }

    const effectiveCurrency = currency ?? existingExpense.currency;
    const effectiveAmount = amount ?? existingExpense.amount;

    // Update a specific expense record by ID in the database using Prisma.
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        title,
        ...(categoryId != null && { category: { connect: { id: categoryId } } }),
        spender,
        currency,
        amount,
        ...((currency !== undefined || amount !== undefined) && {
          convertedAmount: await getExchangeRate(effectiveCurrency, "USD", effectiveAmount),
        }),
        ...(date && { date: new Date(date) }),
      },
    });

    // Respond with the updated expense record.
    res.status(200).json(updatedExpense);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Expense not found." });
    }
    next(error);
  }
});

router.delete("/:id", requireValidId, async (req, res, next) => {
  const id = res.locals.id;

  try {
    // Delete a specific expense record by ID from the database using Prisma.
    await prisma.expense.delete({
      where: { id },
    });

    // Respond with a success message.
    res.status(200).json({ message: "Expense deleted successfully." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Expense not found." });
    }
    next(error);
  }
});

export default router;
