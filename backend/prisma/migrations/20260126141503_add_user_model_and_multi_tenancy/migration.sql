-- Migration: Add User model and multi-tenancy support
-- This migration adds userId to all user-owned tables for multi-tenant support

-- DropIndex (old single-column indexes replaced by composite)
DROP INDEX IF EXISTS "DayData_date_idx";
DROP INDEX IF EXISTS "DayData_date_key";
DROP INDEX IF EXISTS "Location_lat_lon_idx";
DROP INDEX IF EXISTS "Location_timestamp_idx";
DROP INDEX IF EXISTS "Visit_endTime_idx";
DROP INDEX IF EXISTS "Visit_startTime_idx";

-- CreateTable: User (links to Supabase Auth)
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: User email unique
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable: Add userId columns (nullable for migration)
ALTER TABLE "Location" ADD COLUMN "userId" TEXT;
ALTER TABLE "Visit" ADD COLUMN "userId" TEXT;
ALTER TABLE "DayData" ADD COLUMN "userId" TEXT;
ALTER TABLE "Enrichment" ADD COLUMN "userId" TEXT;

-- CreateIndex: Composite indexes for multi-tenant queries
CREATE INDEX "Location_userId_timestamp_idx" ON "Location"("userId", "timestamp");
CREATE INDEX "Location_userId_lat_lon_idx" ON "Location"("userId", "lat", "lon");
CREATE INDEX "Visit_userId_startTime_idx" ON "Visit"("userId", "startTime");
CREATE INDEX "Visit_userId_placeID_idx" ON "Visit"("userId", "placeID");
CREATE INDEX "DayData_userId_date_idx" ON "DayData"("userId", "date");
CREATE UNIQUE INDEX "DayData_userId_date_key" ON "DayData"("userId", "date");
CREATE INDEX "Enrichment_userId_type_status_idx" ON "Enrichment"("userId", "type", "status");

-- AddForeignKey: Link tables to User
ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DayData" ADD CONSTRAINT "DayData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Enrichment" ADD CONSTRAINT "Enrichment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
