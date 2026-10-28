-- Correos en minúsculas. Si dos cuentas solo difieren en mayúsculas
-- (Ana@x.com y ana@x.com) la migración se detiene: hay que decidir a mano
-- cuál se queda antes de aplicarla.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" GROUP BY lower("email") HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Hay cuentas cuyo correo solo difiere en mayúsculas. Resuélvelas antes de migrar: SELECT lower(email), array_agg(email) FROM "User" GROUP BY 1 HAVING count(*) > 1;';
  END IF;
END $$;

UPDATE "User" SET "email" = lower("email") WHERE "email" <> lower("email");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailChangeSentAt" TIMESTAMP(3),
ADD COLUMN     "emailChangeTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailChangeTokenHash" TEXT,
ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailChangeTokenHash_key" ON "User"("emailChangeTokenHash");
