-- Convertir columna metodo de enum MetodoPago a TEXT, preservando datos existentes
ALTER TABLE "Pago" ALTER COLUMN "metodo" TYPE TEXT USING "metodo"::TEXT;

-- DropEnum
DROP TYPE "MetodoPago";
