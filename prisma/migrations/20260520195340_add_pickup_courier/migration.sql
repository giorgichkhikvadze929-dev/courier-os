-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "pickupAssignedAt" TIMESTAMP(3),
ADD COLUMN     "pickupCollectedAt" TIMESTAMP(3),
ADD COLUMN     "pickupCourierId" TEXT;

-- CreateIndex
CREATE INDEX "Delivery_pickupCourierId_idx" ON "Delivery"("pickupCourierId");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_pickupCourierId_fkey" FOREIGN KEY ("pickupCourierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
