-- CreateEnum
CREATE TYPE "TipoTrabajoMarketing" AS ENUM ('EMPRESA', 'FREELANCE');

-- AlterTable
ALTER TABLE "marketing_contenidos" ADD COLUMN     "tipoTrabajo" "TipoTrabajoMarketing" NOT NULL DEFAULT 'EMPRESA',
ADD COLUMN     "valor" INTEGER;
