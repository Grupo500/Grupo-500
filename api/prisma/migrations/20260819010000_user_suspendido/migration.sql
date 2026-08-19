-- Cuenta suspendida: acceso cortado (web y API) sin borrar el registro.
ALTER TABLE "User" ADD COLUMN "suspendido" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "suspendidoEn" TIMESTAMP(3);
