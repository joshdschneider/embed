/*
  Warnings:

  - Added the required column `has_references` to the `Collection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "has_references" BOOLEAN NOT NULL;
