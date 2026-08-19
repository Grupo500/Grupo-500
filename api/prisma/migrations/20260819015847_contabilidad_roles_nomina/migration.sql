-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COFUNDADOR';

-- AlterTable
ALTER TABLE "contab_departamentos" ADD COLUMN     "archivado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "contab_registros" ADD COLUMN     "motivo_rechazo" TEXT,
ADD COLUMN     "valor_original" INTEGER;

-- CreateTable
CREATE TABLE "contab_lideres" (
    "id" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "contab_lideres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contab_nomina" (
    "id" BIGSERIAL NOT NULL,
    "persona_id" TEXT NOT NULL,
    "quincena" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contab_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contab_lideres_dept_id_email_key" ON "contab_lideres"("dept_id", "email");

-- CreateIndex
CREATE INDEX "contab_nomina_quincena_idx" ON "contab_nomina"("quincena");

-- CreateIndex
CREATE INDEX "contab_nomina_persona_id_quincena_idx" ON "contab_nomina"("persona_id", "quincena");

-- AddForeignKey
ALTER TABLE "contab_lideres" ADD CONSTRAINT "contab_lideres_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "contab_departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contab_nomina" ADD CONSTRAINT "contab_nomina_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "contab_personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
