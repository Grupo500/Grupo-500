-- AlterTable
ALTER TABLE "Cuota" ADD COLUMN     "medioPago" TEXT,
ADD COLUMN     "notas" TEXT;

-- CreateTable
CREATE TABLE "HistorialEstudiante" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cambios" JSONB,
    "realizadoPor" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialEstudiante_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HistorialEstudiante" ADD CONSTRAINT "HistorialEstudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
