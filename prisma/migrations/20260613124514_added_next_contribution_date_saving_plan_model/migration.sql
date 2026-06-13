/*
  Warnings:

  - Added the required column `nextContributionDate` to the `SavingPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SavingPlan" ADD COLUMN     "nextContributionDate" TIMESTAMP(3) NOT NULL;
