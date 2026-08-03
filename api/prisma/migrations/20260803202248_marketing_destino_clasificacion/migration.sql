-- CreateEnum
CREATE TYPE "DestinoContenido" AS ENUM ('SEBASTIAN_PERSONAL', 'ANDRES_PERSONAL', 'PREICFES', 'PREMEDICO');

-- CreateEnum
CREATE TYPE "ClasificacionContenido" AS ENUM ('ORGANICO', 'PAUTA');

-- AlterTable
ALTER TABLE "marketing_contenidos" ADD COLUMN     "clasificacion" "ClasificacionContenido" NOT NULL DEFAULT 'ORGANICO',
ADD COLUMN     "destino" "DestinoContenido";
