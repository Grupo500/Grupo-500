-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "cuposDisponibles" INTEGER,
ADD COLUMN     "visibleEnLanding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Estudiante" ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "documentoUrl" TEXT;
