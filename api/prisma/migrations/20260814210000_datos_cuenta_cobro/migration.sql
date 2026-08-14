-- Los datos fijos de la cuenta de cobro: lo que antes se reescribia en cada
-- formulario de la landing y no cambia de un mes a otro.
ALTER TABLE "marketing_miembros"
  ADD COLUMN "nombreCompleto"   TEXT,
  ADD COLUMN "cedula"           TEXT,
  ADD COLUMN "ciudadExpedicion" TEXT,
  ADD COLUMN "ciudad"           TEXT,
  ADD COLUMN "celular"          TEXT,
  ADD COLUMN "banco"            TEXT,
  ADD COLUMN "tipoCuenta"       TEXT,
  ADD COLUMN "numeroCuenta"     TEXT,
  ADD COLUMN "firmaUrl"         TEXT;
