/*
  Warnings:

  - Added the required column `id` to the `ActionRun` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ActionRun" DROP CONSTRAINT "ActionRun_integration_key_environment_id_fkey";

-- DropForeignKey
ALTER TABLE "ActionRun" DROP CONSTRAINT "ActionRun_linked_account_id_fkey";

-- AlterTable
ALTER TABLE "ActionRun" ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "ActionRun_pkey" PRIMARY KEY ("id");
