import express from "express";
import { prisma } from "./prisma.js";
import type { User } from "./generated/prisma/client.js";

// Returns a valid integer id, or null if rawId is missing/not one.
export function parseId(rawId: string | string[] | undefined): number | null {
  if (typeof rawId !== "string" || rawId === "") return null;
  const id = Number(rawId);
  return Number.isInteger(id) ? id : null;
}

// Route-specific middleware: validates :id, or short-circuits with 400.
export function requireValidId(req: express.Request, res: express.Response, next: express.NextFunction) {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "id must be a valid integer." });
  }
  res.locals.id = id;
  next();
}

// Route-specific middleware: requires an active session, or short-circuits with 401.
// Also fetches the full current user (household, role) and attaches it to
// res.locals.currentUser, so routes don't each repeat the same lookup.
export async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } });
  if (!currentUser) {
    return res.status(401).json({ error: "Authentication required." });
  }

  res.locals.currentUser = currentUser;
  next();
}

declare module "express-serve-static-core" {
  interface Locals {
    // passwordHash is globally omitted by the prisma client (see prisma.ts),
    // so it's never actually present on what findUnique returns here.
    currentUser: Omit<User, "passwordHash">;
    id: number;
  }
}

// Error-handling middleware (4 args = how Express identifies it). Registered last, after all routes.
export function errorHandler(err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) {
  console.error(err);
  res.status(500).json({ error: "An unexpected error occurred." });
}
