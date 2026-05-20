-- Agrega campos de contacto institucional al modelo Colegio
ALTER TABLE "Colegio"
  ADD COLUMN IF NOT EXISTS "contactoNombre"   TEXT,
  ADD COLUMN IF NOT EXISTS "contactoEmail"    TEXT,
  ADD COLUMN IF NOT EXISTS "contactoTelefono" TEXT;
