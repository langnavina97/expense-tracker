import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireValidId, requireAuth } from "../middleware.js";
import { Prisma } from "../generated/prisma/client.js";

// Shared body validation for POST (partial: false) and PATCH (partial: true).
// Returns an error message string, or null if valid.
export function validateCategoryInput(
  body: any,
  { partial }: { partial: boolean }
): string | null {
  const { name } = body;

  if (!partial && !name) {
    return "name is required.";
  }

  if (partial && name !== undefined && !name) {
    return "name cannot be empty.";
  }

  return null;
}

const router = Router();

// Every category route requires a logged-in user.
router.use(requireAuth);

router.post("/", async (req, res, next) => {
    const {name} = req.body;

    const validationError = validateCategoryInput(req.body, { partial: false });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        // Create a new category record in the database using Prisma.
        const newCategory = await prisma.category.create({
            data: {
                name,
            },
        });

        // Respond with the newly created category record.
        res.status(201).json(newCategory);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(409).json({ error: `Category "${name}" already exists.` });
        }
        next(error);
    }
});

router.get("/", async (req, res, next) => {
  try {
    // Fetch all category records from the database using Prisma.
    const categories = await prisma.category.findMany();
    
    // Respond with the list of categories.
    res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireValidId, async (req, res, next) => {
  const id = res.locals.id;

  try {
    // Fetch a specific category record by ID from the database using Prisma.
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }

    // Respond with the found category record.
    res.status(200).json(category);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireValidId, async (req, res, next) => {
    const id = res.locals.id;
    const { name } = req.body;

    const validationError = validateCategoryInput(req.body, { partial: true });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        // Update the category record in the database using Prisma.
        const updatedCategory = await prisma.category.update({
            where: { id },
            data: { name },
        });

        // Respond with the updated category record.
        res.status(200).json(updatedCategory);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "Category not found." });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(409).json({ error: `Category "${name}" already exists.` });
        }
        next(error);
    }
});

router.delete("/:id", requireValidId, async (req, res, next) => {
    const id = res.locals.id;

    try {
        // Delete the category record from the database using Prisma.
        await prisma.category.delete({
            where: { id },
        });

        // Respond with a success message.
        res.status(200).json({ message: "Category deleted successfully." });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "Category not found." });
        }
        next(error);
    }
});

export default router;