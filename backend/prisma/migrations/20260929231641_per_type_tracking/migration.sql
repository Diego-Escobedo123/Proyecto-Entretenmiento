-- AlterTable
ALTER TABLE "MediaEntry" ADD COLUMN     "episode" INTEGER,
ADD COLUMN     "hoursPlayed" DOUBLE PRECISION,
ADD COLUMN     "pagesRead" INTEGER,
ADD COLUMN     "pagesTotal" INTEGER,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "season" INTEGER;
