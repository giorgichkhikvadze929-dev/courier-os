/*
  Warnings:

  - You are about to drop the column `scheduledAt` on the `Delivery` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Delivery` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "dropoffAddress" TEXT NOT NULL,
    "zone" TEXT,
    "packageType" TEXT,
    "codAmount" REAL,
    "notes" TEXT,
    "problemFlag" TEXT,
    "companyId" TEXT,
    "courierId" TEXT,
    "verifiedAt" DATETIME,
    "verifiedNote" TEXT,
    "proofNote" TEXT,
    "proofSignedBy" TEXT,
    "courierComment" TEXT,
    "pickedUpAt" DATETIME,
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "refusedAt" DATETIME,
    "returnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Delivery" ("codAmount", "companyId", "courierComment", "courierId", "createdAt", "customerEmail", "customerName", "customerPhone", "deliveredAt", "dropoffAddress", "failedAt", "id", "notes", "packageType", "pickedUpAt", "priority", "problemFlag", "proofNote", "proofSignedBy", "refusedAt", "returnedAt", "status", "trackingNumber", "updatedAt", "verifiedAt", "verifiedNote", "zone") SELECT "codAmount", "companyId", "courierComment", "courierId", "createdAt", "customerEmail", "customerName", "customerPhone", "deliveredAt", "dropoffAddress", "failedAt", "id", "notes", "packageType", "pickedUpAt", "priority", "problemFlag", "proofNote", "proofSignedBy", "refusedAt", "returnedAt", "status", "trackingNumber", "updatedAt", "verifiedAt", "verifiedNote", "zone" FROM "Delivery";
DROP TABLE "Delivery";
ALTER TABLE "new_Delivery" RENAME TO "Delivery";
CREATE UNIQUE INDEX "Delivery_trackingNumber_key" ON "Delivery"("trackingNumber");
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
CREATE INDEX "Delivery_companyId_idx" ON "Delivery"("companyId");
CREATE INDEX "Delivery_courierId_idx" ON "Delivery"("courierId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
