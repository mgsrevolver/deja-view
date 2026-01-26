-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "activityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "placeID" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "semanticType" TEXT,
    "probability" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "defaultImageUrl" TEXT,
    "address" TEXT,
    "types" TEXT[],
    "firstVisit" TIMESTAMP(3),
    "lastVisit" TIMESTAMP(3),
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "uniqueDays" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayData" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distanceByType" JSONB NOT NULL,
    "totalDistance" INTEGER NOT NULL DEFAULT 0,
    "weather" JSONB,
    "spotifyTracks" JSONB,
    "topArtists" TEXT[],
    "newsHeadlines" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrichment" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "visitId" TEXT,
    "placeId" TEXT,
    "date" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_timestamp_idx" ON "Location"("timestamp");

-- CreateIndex
CREATE INDEX "Location_lat_lon_idx" ON "Location"("lat", "lon");

-- CreateIndex
CREATE INDEX "Visit_placeID_idx" ON "Visit"("placeID");

-- CreateIndex
CREATE INDEX "Visit_startTime_idx" ON "Visit"("startTime");

-- CreateIndex
CREATE INDEX "Visit_endTime_idx" ON "Visit"("endTime");

-- CreateIndex
CREATE INDEX "Place_name_idx" ON "Place"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DayData_date_key" ON "DayData"("date");

-- CreateIndex
CREATE INDEX "DayData_date_idx" ON "DayData"("date");

-- CreateIndex
CREATE INDEX "Enrichment_type_status_idx" ON "Enrichment"("type", "status");

-- CreateIndex
CREATE INDEX "Enrichment_visitId_idx" ON "Enrichment"("visitId");

-- CreateIndex
CREATE INDEX "Enrichment_date_idx" ON "Enrichment"("date");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_placeID_fkey" FOREIGN KEY ("placeID") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrichment" ADD CONSTRAINT "Enrichment_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
