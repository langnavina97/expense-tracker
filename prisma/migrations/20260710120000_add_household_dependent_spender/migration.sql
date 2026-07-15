-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEAD', 'ADULT', 'CHILD');

-- DropIndex
DROP INDEX "Category_name_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "householdId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "spender",
ADD COLUMN     "createdByUserId" INTEGER NOT NULL,
ADD COLUMN     "householdId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "householdId" INTEGER,
ADD COLUMN     "role" "Role",
ADD COLUMN     "spenderId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Household" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "householdId" INTEGER NOT NULL,
    "spenderId" INTEGER NOT NULL,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spender" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Spender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExpenseToSpender" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ExpenseToSpender_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dependent_spenderId_key" ON "Dependent"("spenderId");

-- CreateIndex
CREATE INDEX "_ExpenseToSpender_B_index" ON "_ExpenseToSpender"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Category_householdId_name_key" ON "Category"("householdId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_spenderId_key" ON "User"("spenderId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_spenderId_fkey" FOREIGN KEY ("spenderId") REFERENCES "Spender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_spenderId_fkey" FOREIGN KEY ("spenderId") REFERENCES "Spender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpenseToSpender" ADD CONSTRAINT "_ExpenseToSpender_A_fkey" FOREIGN KEY ("A") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpenseToSpender" ADD CONSTRAINT "_ExpenseToSpender_B_fkey" FOREIGN KEY ("B") REFERENCES "Spender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

