-- AlterTable
ALTER TABLE "LogEntry" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Las entradas existentes: su último cambio conocido es su creación.
UPDATE "LogEntry" SET "updatedAt" = "createdAt";
