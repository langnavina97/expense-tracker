import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireValidId, requireAuth } from "../middleware.js";
import { Prisma } from "../generated/prisma/client.js";

import argon2 from "argon2";

// Shared body validation for POST (partial: false) and PATCH (partial: true).
// Returns an error message string, or null if valid.
export function validateUserInput(
  body: any,
  { partial }: { partial: boolean }
): string | null {
  const { name, email, password } = body;

  if (!partial && (!name || !email || !password)) {
    return "name, email, and password are required.";
  }

  if (partial && name !== undefined && !name) {
    return "name cannot be empty.";
  }

  if (partial && email !== undefined && !email) {
    return "email cannot be empty.";
  }

  return null;
}

const router = Router();

router.post("/", async (req, res, next) => {
    const {name, email, password} = req.body;

    const validationError = validateUserInput(req.body, { partial: false });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const passwordHash = await argon2.hash(password);

    try {
        // Create a new user record in the database using Prisma.
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash
            },
        });

        // Respond with the newly created user record.
        res.status(201).json(newUser);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(409).json({ error: `User "${email}" already exists.` });
        }
        next(error);
    }
});

router.post("/login", async (req, res, next) => {

   const { email, password } = req.body;

  try {
    // Fetch a specific user record by email from the database using Prisma.
    const user = await prisma.user.findUnique({
      where: { email },
      omit: { passwordHash: false },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.userId = user.id; // Store the user ID in the session

    const { passwordHash, ...safeUser } = user;

    // Respond with the found user record.
    res.status(200).json(safeUser);
  } catch (error) {
    next(error);
  }
});

// Every route below this point requires a logged-in user.
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    // Fetch all users records from the database using Prisma.
    const users = await prisma.user.findMany();
    
    // Respond with the list of users.
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireValidId, async (req, res, next) => {
  const id = res.locals.id;

  try {
    // Fetch a specific user record by ID from the database using Prisma.
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Respond with the found user record.
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});


router.patch("/:id", requireValidId, async (req, res, next) => {
    const id = res.locals.id;
    const { name, email  } = req.body;

    const validationError = validateUserInput(req.body, { partial: true });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        // Update the user record in the database using Prisma.
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { name, email },
        });

        // Respond with the updated user record.
        res.status(200).json(updatedUser);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "User not found." });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(409).json({ error: `User "${email}" already exists.` });
        }
        next(error);
    }
});

router.delete("/:id", requireValidId, async (req, res, next) => {
    const id = res.locals.id;

    try {
        // Delete the user record from the database using Prisma.
        await prisma.user.delete({
            where: { id },
        });

        // Respond with a success message.
        res.status(200).json({ message: "User deleted successfully." });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "User not found." });
        }
        next(error);
    }
});


export default router;