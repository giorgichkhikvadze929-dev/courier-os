-- AlterTable — Order: add type, courier link, allow nullable company
ALTER TABLE "Order" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'IMPORT';
ALTER TABLE "Order" ADD COLUMN "courierId" TEXT;
ALTER TABLE "Order" ALTER COLUMN "companyId" DROP NOT NULL;

-- AddForeignKey — Order.courierId → User
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_courierId_fkey"
  FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Order_courierId_idx" ON "Order"("courierId");
CREATE INDEX "Order_type_idx"      ON "Order"("type");

-- AlterTable — Delivery: add assignmentOrderId
ALTER TABLE "Delivery" ADD COLUMN "assignmentOrderId" TEXT;

-- CreateIndex
CREATE INDEX "Delivery_assignmentOrderId_idx" ON "Delivery"("assignmentOrderId");

-- AddForeignKey — Delivery.assignmentOrderId → Order
ALTER TABLE "Delivery"
  ADD CONSTRAINT "Delivery_assignmentOrderId_fkey"
  FOREIGN KEY ("assignmentOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
