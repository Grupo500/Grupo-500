-- Asesor retirado del equipo: sale del ranking pero se conserva 60 días
-- (desde retiradoEn) por si vuelve; después se purga del todo.
ALTER TABLE "Asesor" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Asesor" ADD COLUMN "retiradoEn" TIMESTAMP(3);
