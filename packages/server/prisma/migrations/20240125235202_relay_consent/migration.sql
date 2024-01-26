-- AlterTable
ALTER TABLE "LinkedAccount" ADD COLUMN     "consent_date" INTEGER,
ADD COLUMN     "consent_given" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consent_ip" TEXT;
