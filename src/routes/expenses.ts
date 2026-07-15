import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireValidId, requireAuth } from "../middleware.js";
import { Prisma, Role } from "../generated/prisma/client.js";

import { getExchangeRate } from "../exchangeRate.js";
import { suggestCategory } from "../categorize.js";

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "MXN", "GBP", "JPY", "CAD", "CHF"];

// Shared body validation for POST (partial: false) and PATCH (partial: true).
// Returns an error message string, or null if valid.
export function validateExpenseInput(
  body: any,
  { partial }: { partial: boolean }
): string | null {
  const { categoryId, spenderIds, currency, amount, date } = body;
  const spenderIdsMissing = !Array.isArray(spenderIds) || spenderIds.length === 0;

  if (!partial && (spenderIdsMissing || !currency || amount == null || !date || categoryId == null)) {
    return "categoryId, spenderIds, currency, amount, and date are required.";
  }

  if (partial && spenderIds !== undefined && spenderIdsMissing) {
    return "spenderIds must be a non-empty array.";
  }

  if (currency !== undefined && !SUPPORTED_CURRENCIES.includes(currency)) {
    return `Unsupported currency: ${currency}`;
  }

  return null;
}

// Confirms every given Spender id exists and belongs to the given household.
// Returns an error message, or null if all valid.
async function validateSpenderIds(spenderIds: number[], householdId: number): Promise<string | null> {
  const spenders = await prisma.spender.findMany({
    where: { id: { in: spenderIds } },
    include: { user: true, dependent: true },
  });

  if (spenders.length !== spenderIds.length) {
    return "One or more spenderIds do not exist.";
  }

  const allInHousehold = spenders.every(
    (s) => s.user?.householdId === householdId || s.dependent?.householdId === householdId
  );

  if (!allInHousehold) {
    return "One or more spenderIds do not belong to your household.";
  }

  return null;
}

// Only the household lead/adult who created an expense, or the person who
// created it, may modify it - a CHILD may only touch their own expenses.
function canModifyExpense(currentUser: { id: number; role: Role | null }, expense: { createdByUserId: number }) {
  return currentUser.role !== Role.CHILD || expense.createdByUserId === currentUser.id;
}

const router = Router();

// Every expense route requires a logged-in user.
router.use(requireAuth);

router.post("/suggest-category", async (req, res, next) => {
  const { title } = req.body;
  const { currentUser } = res.locals;

  if (!title) {
    return res.status(400).json({ error: "title is required." });
  }

  try {
    const categories = currentUser.householdId
      ? await prisma.category.findMany({ where: { householdId: currentUser.householdId } })
      : [];

    const suggestedName = await suggestCategory(title, categories.map((c) => c.name));
    const suggestedCategory = categories.find((c) => c.name === suggestedName) ?? null;

    res.status(200).json({ suggestedCategory });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const { title, categoryId, spenderIds, currency, amount, date } = req.body;
  const { currentUser } = res.locals;

  const validationError = validateExpenseInput(req.body, { partial: false });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You must belong to a household to create an expense." });
  }

  const spenderError = await validateSpenderIds(spenderIds, currentUser.householdId);
  if (spenderError) {
    return res.status(400).json({ error: spenderError });
  }

  try {
    // Create a new expense record in the database using Prisma.
    const expense = await prisma.expense.create({
      data: {
        title,
        category: { connect: { id: categoryId } },
        household: { connect: { id: currentUser.householdId } },
        createdBy: { connect: { id: currentUser.id } },
        spenders: { connect: spenderIds.map((id: number) => ({ id })) },
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
    // Only list expenses belonging to the current user's household.
    const { householdId } = res.locals.currentUser;
    const expenses = householdId
      ? await prisma.expense.findMany({ where: { householdId }, include: { spenders: true } })
      : [];

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
      include: { spenders: true },
    });

    if (!expense || expense.householdId !== res.locals.currentUser.householdId) {
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
  const { title, categoryId, spenderIds, currency, amount, date } = req.body;
  const { currentUser } = res.locals;

  const validationError = validateExpenseInput(req.body, { partial: true });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const existingExpense = await prisma.expense.findUnique({ where: { id } });
    if (!existingExpense || existingExpense.householdId !== currentUser.householdId) {
      return res.status(404).json({ error: "Expense not found." });
    }

    if (!canModifyExpense(currentUser, existingExpense)) {
      return res.status(403).json({ error: "You can only modify expenses you created." });
    }

    if (spenderIds !== undefined) {
      const spenderError = await validateSpenderIds(spenderIds, currentUser.householdId);
      if (spenderError) {
        return res.status(400).json({ error: spenderError });
      }
    }

    const effectiveCurrency = currency ?? existingExpense.currency;
    const effectiveAmount = amount ?? existingExpense.amount;

    // Update a specific expense record by ID in the database using Prisma.
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        title,
        ...(categoryId != null && { category: { connect: { id: categoryId } } }),
        ...(spenderIds !== undefined && {
          spenders: { set: spenderIds.map((sid: number) => ({ id: sid })) },
        }),
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
  const { currentUser } = res.locals;

  try {
    const existingExpense = await prisma.expense.findUnique({ where: { id } });
    if (!existingExpense || existingExpense.householdId !== currentUser.householdId) {
      return res.status(404).json({ error: "Expense not found." });
    }

    if (!canModifyExpense(currentUser, existingExpense)) {
      return res.status(403).json({ error: "You can only delete expenses you created." });
    }

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
