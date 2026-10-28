-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifySentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifyTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifyTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyTokenHash_key" ON "User"("emailVerifyTokenHash");

-- Las cuentas que ya existían se dan por verificadas: nunca recibieron el
-- correo y no deberían ver el aviso de verificación de golpe.
UPDATE "User" SET "emailVerifiedAt" = "createdAt";
