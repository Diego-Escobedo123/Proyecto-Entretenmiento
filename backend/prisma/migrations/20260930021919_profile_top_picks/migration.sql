-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "topPicks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "tagline" SET DEFAULT '',
ALTER COLUMN "quote" SET DEFAULT '';

-- Los textos por defecto de antes no los escribió nadie: se vacían para que
-- el perfil no muestre como propia una frase genérica.
UPDATE "Profile" SET "tagline" = '' WHERE "tagline" = 'Tu identidad cultural';
UPDATE "Profile" SET "quote" = '' WHERE "quote" = 'Cada obra cuenta una historia. Juntas cuentan la tuya.';
