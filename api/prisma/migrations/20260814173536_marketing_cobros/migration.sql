-- CreateEnum
CREATE TYPE "EstadoCobroMarketing" AS ENUM ('POR_APROBAR', 'APROBADO', 'PAGADO');

-- AlterTable
ALTER TABLE "marketing_contenidos" ADD COLUMN     "aprobadoEn" TIMESTAMP(3),
ADD COLUMN     "aprobadoPorId" TEXT,
ADD COLUMN     "estadoCobro" "EstadoCobroMarketing" NOT NULL DEFAULT 'POR_APROBAR',
ADD COLUMN     "pagadoEn" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "marketing_contenidos" ADD CONSTRAINT "marketing_contenidos_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "marketing_miembros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
