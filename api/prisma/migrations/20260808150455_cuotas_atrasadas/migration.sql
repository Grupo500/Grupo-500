-- CreateTable
CREATE TABLE "cuotas_atrasadas" (
    "id" TEXT NOT NULL,
    "transaccion" TEXT NOT NULL,
    "estudianteId" TEXT,
    "emailComprador" TEXT NOT NULL,
    "nombreComprador" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "productoNombre" TEXT NOT NULL,
    "cuotaNumero" INTEGER NOT NULL,
    "cuotasTotal" INTEGER NOT NULL,
    "monto" INTEGER NOT NULL,
    "fechaCobro" TIMESTAMP(3) NOT NULL,
    "sincronizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuotas_atrasadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuotas_atrasadas_transaccion_key" ON "cuotas_atrasadas"("transaccion");

-- CreateIndex
CREATE INDEX "cuotas_atrasadas_estudianteId_idx" ON "cuotas_atrasadas"("estudianteId");

-- AddForeignKey
ALTER TABLE "cuotas_atrasadas" ADD CONSTRAINT "cuotas_atrasadas_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
