import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireValidId } from "../middleware.js";
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
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      return res.status(404).json({ error: "User not found." });
    }

    // Without this check, adding someone who already belongs to a household
    // (possibly as its own lead) silently rips them out of it and
    // overwrites their role - orphaning whatever household they had.
    if (targetUser.householdId) {
      return res.status(409).json({ error: "This user already belongs to a household." });
    }

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

// Change an existing member's role. LEAD only, and not on yourself - that
// could leave the household with no lead at all.
router.patch("/members/:id", requireValidId, async (req, res, next) => {
  const targetId = res.locals.id;
  const { role } = req.body;
  const currentUser = res.locals.currentUser;

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You don't belong to a household." });
  }

  if (currentUser.role !== Role.LEAD) {
    return res.status(403).json({ error: "Only the household lead can change roles." });
  }

  if (!role || !(role in Role)) {
    return res.status(400).json({ error: "A valid role is required." });
  }

  if (targetId === currentUser.id) {
    return res.status(400).json({ error: "You can't change your own role." });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser || targetUser.deletedAt || targetUser.householdId !== currentUser.householdId) {
      return res.status(404).json({ error: "User not found in your household." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: { role },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "User not found." });
    }
    next(error);
  }
});

// Remove a member from my household. LEAD only, and not on yourself - that
// would leave the household with no lead.
router.delete("/members/:id", requireValidId, async (req, res, next) => {
  const targetId = res.locals.id;
  const currentUser = res.locals.currentUser;

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You don't belong to a household." });
  }

  if (currentUser.role !== Role.LEAD) {
    return res.status(403).json({ error: "Only the household lead can remove members." });
  }

  if (targetId === currentUser.id) {
    return res.status(400).json({ error: "You can't remove yourself from the household." });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser || targetUser.deletedAt || targetUser.householdId !== currentUser.householdId) {
      return res.status(404).json({ error: "User not found in your household." });
    }

    await prisma.user.update({
      where: { id: targetId },
      data: { householdId: null, role: null },
    });

    res.status(200).json({ message: "Member removed successfully." });
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

// Rename a dependent. LEAD or ADULT only.
router.patch("/dependents/:id", requireValidId, async (req, res, next) => {
  const targetId = res.locals.id;
  const { name } = req.body;
  const currentUser = res.locals.currentUser;

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You don't belong to a household." });
  }

  if (currentUser.role !== Role.LEAD && currentUser.role !== Role.ADULT) {
    return res.status(403).json({ error: "Only a household lead or adult can edit dependents." });
  }

  if (!name) {
    return res.status(400).json({ error: "name is required." });
  }

  try {
    const existing = await prisma.dependent.findUnique({ where: { id: targetId } });
    if (!existing || existing.householdId !== currentUser.householdId) {
      return res.status(404).json({ error: "Dependent not found." });
    }

    const updated = await prisma.dependent.update({ where: { id: targetId }, data: { name } });

    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Dependent not found." });
    }
    next(error);
  }
});

// Remove a dependent. LEAD or ADULT only. The underlying Spender row is left
// in place (not deleted) - past expenses that included this dependent still
// need something to point to, the same reasoning as soft-deleting a User.
router.delete("/dependents/:id", requireValidId, async (req, res, next) => {
  const targetId = res.locals.id;
  const currentUser = res.locals.currentUser;

  if (!currentUser.householdId) {
    return res.status(400).json({ error: "You don't belong to a household." });
  }

  if (currentUser.role !== Role.LEAD && currentUser.role !== Role.ADULT) {
    return res.status(403).json({ error: "Only a household lead or adult can remove dependents." });
  }

  try {
    const existing = await prisma.dependent.findUnique({ where: { id: targetId } });
    if (!existing || existing.householdId !== currentUser.householdId) {
      return res.status(404).json({ error: "Dependent not found." });
    }

    await prisma.dependent.delete({ where: { id: targetId } });

    res.status(200).json({ message: "Dependent removed successfully." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Dependent not found." });
    }
    next(error);
  }
});

export default router;
