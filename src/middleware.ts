import express from "express";

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
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }
  next();
}

// Error-handling middleware (4 args = how Express identifies it). Registered last, after all routes.
export function errorHandler(err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) {
  console.error(err);
  res.status(500).json({ error: "An unexpected error occurred." });
}
