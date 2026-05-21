-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "city" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "geoPlaceId" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "postalCode" TEXT;

-- CreateTable
CREATE TABLE "GeoPlace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameKa" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CITY',
    "regionCode" TEXT NOT NULL,
    "municipality" TEXT,
    "postalCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "GeoPlace_regionCode_idx" ON "GeoPlace"("regionCode");

-- CreateIndex
CREATE INDEX "GeoPlace_postalCode_idx" ON "GeoPlace"("postalCode");

-- CreateIndex
CREATE INDEX "GeoPlace_name_idx" ON "GeoPlace"("name");
