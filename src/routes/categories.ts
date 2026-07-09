import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireValidId } from "../middleware.js";
import { Prisma } from "../generated/prisma/client.js";

const router = Router();

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

router.post("/", async (req, res, next) => {
    const {name} = req.body;

    if (!name) {
        return res.status(400).json({ error: "name is required." });
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

router.patch("/:id", requireValidId, async (req, res, next) => {
    const id = res.locals.id;
    const { name } = req.body;

    if (name !== undefined && !name) {
        return res.status(400).json({ error: "name cannot be empty." });
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