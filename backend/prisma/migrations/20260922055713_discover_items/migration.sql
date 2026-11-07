-- CreateTable
CREATE TABLE "DiscoverItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "rating" DOUBLE PRECISION,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "award" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoverItem_award_idx" ON "DiscoverItem"("award");
