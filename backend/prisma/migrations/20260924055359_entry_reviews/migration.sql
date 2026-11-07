-- AlterTable
ALTER TABLE "MediaEntry" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "notesPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "review" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "MediaEntry_type_externalId_idx" ON "MediaEntry"("type", "externalId");
