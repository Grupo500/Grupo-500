-- CreateTable
CREATE TABLE "Observacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Observacion" ADD CONSTRAINT "Observacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
