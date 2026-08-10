-- AlterTable
ALTER TABLE "sim_estudiantes" ADD COLUMN     "tipo_documento" TEXT;

-- CreateTable
CREATE TABLE "sim_accesos" (
    "id" TEXT NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "simulacro_id" INTEGER NOT NULL,
    "habilitado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retirado_at" TIMESTAMP(3),

    CONSTRAINT "sim_accesos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sim_accesos_simulacro_id_idx" ON "sim_accesos"("simulacro_id");

-- CreateIndex
CREATE UNIQUE INDEX "sim_accesos_estudiante_id_simulacro_id_key" ON "sim_accesos"("estudiante_id", "simulacro_id");

-- AddForeignKey
ALTER TABLE "sim_accesos" ADD CONSTRAINT "sim_accesos_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "sim_estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_accesos" ADD CONSTRAINT "sim_accesos_simulacro_id_fkey" FOREIGN KEY ("simulacro_id") REFERENCES "sim_simulacros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: hasta hoy todo estudiante veía todos los exámenes; se conserva esa
-- visibilidad creando el acceso explícito para cada par estudiante×examen
-- existente (excepto el banco interno de Brito, id 9999). Los accesos nuevos
-- ya entran solo por CSV/admin.
INSERT INTO "sim_accesos" ("id", "estudiante_id", "simulacro_id")
SELECT gen_random_uuid()::text, e."id", s."id"
FROM "sim_estudiantes" e
CROSS JOIN "sim_simulacros" s
WHERE s."id" <> 9999;
