-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "billingAnchorDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastAutoInvoiceAt" TIMESTAMP(3);
