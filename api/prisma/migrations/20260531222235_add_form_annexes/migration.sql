-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "fechaIcfes" TIMESTAMP(3),
ADD COLUMN     "simulacros" INTEGER;

-- AlterTable
ALTER TABLE "Estudiante" ADD COLUMN     "verificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificadoAt" TIMESTAMP(3),
ADD COLUMN     "verificadoPor" TEXT;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "comprobanteAt" TIMESTAMP(3),
ADD COLUMN     "referenciaPago" TEXT;
