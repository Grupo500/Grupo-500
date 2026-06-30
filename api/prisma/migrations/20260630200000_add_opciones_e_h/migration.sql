-- Agrega opciones E, F, G, H a sim_preguntas para preguntas de matching (hasta 8 opciones)
ALTER TABLE "sim_preguntas" ADD COLUMN "opcion_e" TEXT;
ALTER TABLE "sim_preguntas" ADD COLUMN "opcion_f" TEXT;
ALTER TABLE "sim_preguntas" ADD COLUMN "opcion_g" TEXT;
ALTER TABLE "sim_preguntas" ADD COLUMN "opcion_h" TEXT;
