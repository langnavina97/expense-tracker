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
        // Create the user and its Spender identity together, atomically -
        // every User must have exactly one Spender, created at the same time.
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                spender: { create: {} },
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

    // Google-only accounts have no passwordHash at all - reject the same way
    // as any other invalid login, don't reveal an account exists but has no password.
    if (!user || user.deletedAt || !user.passwordHash) {
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

// Lets the frontend ask "who am I?" on load to bootstrap auth state, without
// guessing at an id from a list of household members.
router.get("/me", (req, res) => {
  res.status(200).json(res.locals.currentUser);
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.status(200).json({ message: "Logged out successfully." });
  });
});

router.get("/", async (req, res, next) => {
  try {
    // Only ever list users within the current user's own household - a user
    // with no household yet only ever sees themselves.
    const { householdId } = res.locals.currentUser;
    const users = householdId
      ? await prisma.user.findMany({ where: { householdId, deletedAt: null } })
      : [res.locals.currentUser];

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

    if (!user || user.deletedAt) {
      return res.status(404).json({ error: "User not found." });
    }

    const isSelf = id === res.locals.currentUser.id;
    const isSameHousehold =
      user.householdId !== null && user.householdId === res.locals.currentUser.householdId;

    if (!isSelf && !isSameHousehold) {
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

    if (id !== res.locals.currentUser.id) {
      return res.status(403).json({ error: "You can only update your own account." });
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

    if (id !== res.locals.currentUser.id) {
      return res.status(403).json({ error: "You can only delete your own account." });
    }

    try {
        // Soft delete: keep the row (existing expenses still reference a
        // valid creator) but anonymize personal data and mark it inactive.
        await prisma.user.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                email: `deleted-user-${id}@deleted.invalid`,
                name: "Deleted User",
                passwordHash: "",
            },
        });

        req.session.destroy((err) => {
            if (err) return next(err);
            res.status(200).json({ message: "User deleted successfully." });
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "User not found." });
        }
        next(error);
    }
});


export default router;
