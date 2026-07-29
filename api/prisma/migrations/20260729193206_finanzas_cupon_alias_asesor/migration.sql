-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "afiliadoHotmart" TEXT,
ADD COLUMN     "cupon" TEXT;

-- CreateTable
CREATE TABLE "finanzas_alias_asesor" (
    "alias" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finanzas_alias_asesor_pkey" PRIMARY KEY ("alias")
);

-- CreateIndex
CREATE INDEX "finanzas_alias_asesor_asesorId_idx" ON "finanzas_alias_asesor"("asesorId");

-- AddForeignKey
ALTER TABLE "finanzas_alias_asesor" ADD CONSTRAINT "finanzas_alias_asesor_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Asesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
