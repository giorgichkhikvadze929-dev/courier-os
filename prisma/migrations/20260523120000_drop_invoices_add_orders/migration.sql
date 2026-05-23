-- DropForeignKey
ALTER TABLE "InvoiceLineItem" DROP CONSTRAINT IF EXISTS "InvoiceLineItem_invoiceId_fkey";
ALTER TABLE "InvoiceLineItem" DROP CONSTRAINT IF EXISTS "InvoiceLineItem_deliveryId_fkey";
ALTER TABLE "Invoice"         DROP CONSTRAINT IF EXISTS "Invoice_companyId_fkey";

-- DropTable
DROP TABLE IF EXISTS "InvoiceLineItem";
DROP TABLE IF EXISTS "Invoice";

-- AlterTable — strip the auto-invoice billing columns from Company
ALTER TABLE "Company" DROP COLUMN IF EXISTS "billingCycle";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "billingAnchorDay";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "lastAutoInvoiceAt";

-- CreateTable
CREATE TABLE "Order" (
    "id"            TEXT      NOT NULL,
    "orderNumber"   TEXT      NOT NULL,
    "companyId"     TEXT      NOT NULL,
    "importBatchId" TEXT,
    "parcelCount"   INTEGER   NOT NULL DEFAULT 0,
    "totalValue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key"   ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_importBatchId_key" ON "Order"("importBatchId");
CREATE INDEX        "Order_companyId_idx"     ON "Order"("companyId");

-- AddForeignKey
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable — give every Delivery an optional pointer back to its parent Order
ALTER TABLE "Delivery" ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE INDEX "Delivery_orderId_idx" ON "Delivery"("orderId");

-- AddForeignKey
ALTER TABLE "Delivery"
  ADD CONSTRAINT "Delivery_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
