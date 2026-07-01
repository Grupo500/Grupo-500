-- Cronómetro pausable de 4:30h por sesión del simulacro (sim_intentos) +
-- retroalimentación específica por opción incorrecta (sim_preguntas).
-- Aditivo: no modifica columnas existentes.

-- AlterTable
ALTER TABLE "sim_intentos" ADD COLUMN "sesion1_iniciado_en" TIMESTAMP(3);
ALTER TABLE "sim_intentos" ADD COLUMN "sesion1_consumido_seg" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sim_intentos" ADD COLUMN "sesion2_iniciado_en" TIMESTAMP(3);
ALTER TABLE "sim_intentos" ADD COLUMN "sesion2_consumido_seg" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sim_preguntas" ADD COLUMN "retro_opciones" JSONB;
