-- CreateEnum
CREATE TYPE "EtapaNegociacion" AS ENUM ('PROSPECTO', 'CONTACTO_INICIAL', 'VISITA_PROGRAMADA', 'PROPUESTA_ENVIADA', 'EN_NEGOCIACION', 'CONVENIO_FIRMADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "Negociacion" (
    "id" TEXT NOT NULL,
    "colegioId" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "etapa" "EtapaNegociacion" NOT NULL DEFAULT 'PROSPECTO',
    "notas" TEXT,
    "fechaContacto" TIMESTAMP(3),
    "fechaVisita" TIMESTAMP(3),
    "fechaProxContacto" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negociacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Negociacion" ADD CONSTRAINT "Negociacion_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negociacion" ADD CONSTRAINT "Negociacion_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Asesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
