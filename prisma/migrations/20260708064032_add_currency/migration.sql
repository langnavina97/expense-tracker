/*
  Warnings:

  - Added the required column `currency` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "convertedAmount" INTEGER,
ADD COLUMN     "currency" TEXT NOT NULL;
