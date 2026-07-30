-- AlterTable
ALTER TABLE "finanzas_inversion_publicitaria" ADD COLUMN     "campaniaId" TEXT,
ADD COLUMN     "fuente" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "finanzas_inversion_publicitaria_plataforma_campaniaId_desde_key" ON "finanzas_inversion_publicitaria"("plataforma", "campaniaId", "desde");

