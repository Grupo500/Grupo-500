-- Migración: etapas de negociación v2
-- Prospecto → Contacto → Propuesta → Reunión → Convenio → Descartado

-- Paso 1: Convertir columna a TEXT y eliminar el default para poder soltar el enum
ALTER TABLE "Negociacion" ALTER COLUMN etapa DROP DEFAULT;
ALTER TABLE "Negociacion" ALTER COLUMN etapa TYPE TEXT;

-- Paso 2: Migrar valores antiguos a nuevos (como texto)
UPDATE "Negociacion" SET etapa = 'CONTACTO'  WHERE etapa = 'CONTACTO_INICIAL';
UPDATE "Negociacion" SET etapa = 'PROPUESTA'  WHERE etapa = 'PROPUESTA_ENVIADA';
UPDATE "Negociacion" SET etapa = 'REUNION'    WHERE etapa IN ('VISITA_PROGRAMADA', 'EN_NEGOCIACION');
UPDATE "Negociacion" SET etapa = 'CONVENIO'   WHERE etapa = 'CONVENIO_FIRMADO';

-- Paso 3: Eliminar enum viejo y crear el nuevo
DROP TYPE "EtapaNegociacion";
CREATE TYPE "EtapaNegociacion" AS ENUM ('PROSPECTO', 'CONTACTO', 'PROPUESTA', 'REUNION', 'CONVENIO', 'DESCARTADO');

-- Paso 4: Restaurar columna al nuevo enum con default
ALTER TABLE "Negociacion"
  ALTER COLUMN etapa TYPE "EtapaNegociacion" USING etapa::"EtapaNegociacion",
  ALTER COLUMN etapa SET DEFAULT 'PROSPECTO';

-- Paso 5: Renombrar fechaVisita → fechaReunion
ALTER TABLE "Negociacion" RENAME COLUMN "fechaVisita" TO "fechaReunion";
