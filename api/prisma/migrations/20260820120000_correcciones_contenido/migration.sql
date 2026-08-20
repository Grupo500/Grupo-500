-- Correcciones de un trabajo de marketing: reemplazan el flujo de Trello.
CREATE TABLE "marketing_correcciones" (
    "id" TEXT NOT NULL,
    "contenidoId" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "pedidaPorId" TEXT NOT NULL,
    "resueltaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_correcciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_correcciones_contenidoId_idx" ON "marketing_correcciones"("contenidoId");

ALTER TABLE "marketing_correcciones" ADD CONSTRAINT "marketing_correcciones_contenidoId_fkey"
    FOREIGN KEY ("contenidoId") REFERENCES "marketing_contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketing_correcciones" ADD CONSTRAINT "marketing_correcciones_pedidaPorId_fkey"
    FOREIGN KEY ("pedidaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quién repartió el trabajo: sin esto quien asigna no puede ver lo que asignó.
ALTER TABLE "marketing_contenidos" ADD COLUMN "asignadoPorId" TEXT;
