-- Asesor retirado del equipo: se conserva el historial, sale del ranking.
ALTER TABLE "Asesor" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
