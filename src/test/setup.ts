import { beforeEach } from "vitest";
import { prisma } from "../prisma.js";

// Safety net: this file runs `deleteMany()` on every table before each test.
// If DATABASE_URL somehow isn't pointing at the test database, refuse to run
// rather than risk wiping real data.
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.includes("_test")) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL doesn't look like a test database (${databaseUrl}). Did .env.test load correctly?`
  );
}

beforeEach(async () => {
  await prisma.expense.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
});
