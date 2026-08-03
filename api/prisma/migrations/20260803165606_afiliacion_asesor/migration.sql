-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "linkAfiliacion" TEXT;

-- CreateTable
CREATE TABLE "ventas_afiliaciones_asesor" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "marcadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_afiliaciones_asesor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_afiliaciones_asesor_asesorId_cursoId_key" ON "ventas_afiliaciones_asesor"("asesorId", "cursoId");

-- AddForeignKey
ALTER TABLE "ventas_afiliaciones_asesor" ADD CONSTRAINT "ventas_afiliaciones_asesor_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Asesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_afiliaciones_asesor" ADD CONSTRAINT "ventas_afiliaciones_asesor_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
