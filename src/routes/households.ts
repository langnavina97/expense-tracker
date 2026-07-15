import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware.js";
import { Prisma, Role } from "../generated/prisma/client.js";

const router = Router();

router.use(requireAuth);

// Create a household. The creator becomes its LEAD.
router.post("/", async (req, res, next) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required." });
  }

  if (res.locals.currentUser.householdId) {
    return res.status(400).json({ error: "You already belong to a household." });
  }

  try {
    const household = await prisma.household.create({
      data: {
        name,
        members: {
          connect: { id: res.locals.currentUser.id },
        },
      },
    });

    await prisma.user.update({
      where: { id: res.locals.currentUser.id },
      data: { role: Role.LEAD },
    });

    res.status(201).json(household);
  } catch (error) {
    next(error);
  }
});

// View my household: members and dependents.
router.get("/", async (req, res, next) => {
  const { householdId } = res.locals.currentUser;

  if (!householdId) {
    return res.status(404).json({ error: "You don't belong to a household." });
  }

  try {
    const household = await prisma.household.findUnique({
      where: { id: householdId },
      include: { members: true, dependents: true },
    });

    res.status(200).json(household);
  } catch (error) {
    next(error);
  }
});

// Add an existing, registered user to my household. LEAD only.
router.post("/members", async (req, res, next) => {
  const { userId, role } = req.body;
  const currentUser = res.locals.currentUser;

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You don't belong to a household." });
  }

  if (currentUser.role !== Role.LEAD) {
    return res.status(403).json({ error: "Only the household lead can add members." });
  }

  if (userId == null || !role || !(role in Role)) {
    return res.status(400).json({ error: "userId and a valid role are required." });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { householdId: currentUser.householdId, role },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "User not found." });
    }
    next(error);
  }
});

// Add a dependent (a household member with no login) to my household.
// LEAD or ADULT only.
router.post("/dependents", async (req, res, next) => {
  const { name } = req.body;
  const currentUser = res.locals.currentUser;

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You don't belong to a household." });
  }

  if (currentUser.role !== Role.LEAD && currentUser.role !== Role.ADULT) {
    return res.status(403).json({ error: "Only a household lead or adult can add dependents." });
  }

  if (!name) {
    return res.status(400).json({ error: "name is required." });
  }

  try {
    const dependent = await prisma.dependent.create({
      data: {
        name,
        household: { connect: { id: currentUser.householdId } },
        spender: { create: {} },
      },
    });

    res.status(201).json(dependent);
  } catch (error) {
    next(error);
  }
});

export default router;
