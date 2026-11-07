-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "startedAt" DATE,
    "finishedAt" DATE,
    "rating" DOUBLE PRECISION,
    "repeat" BOOLEAN NOT NULL DEFAULT false,
    "abandoned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogEntry_userId_finishedAt_idx" ON "LogEntry"("userId", "finishedAt");

-- CreateIndex
CREATE INDEX "LogEntry_entryId_idx" ON "LogEntry"("entryId");

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MediaEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: una entrada de diario por cada obra ya empezada o terminada, con
-- las fechas que había (alta = empezó, última edición = terminó).
INSERT INTO "LogEntry" ("id", "userId", "entryId", "startedAt", "finishedAt", "rating", "abandoned")
SELECT
    'backfill_' || "id",
    "userId",
    "id",
    CASE WHEN "status" IN ('in-progress', 'abandoned') THEN "createdAt"::date END,
    CASE WHEN "status" IN ('completed', 'mastered', 'abandoned') THEN "updatedAt"::date END,
    CASE WHEN "status" IN ('completed', 'mastered') THEN "rating" END,
    "status" = 'abandoned'
FROM "MediaEntry"
WHERE "status" <> 'want';
