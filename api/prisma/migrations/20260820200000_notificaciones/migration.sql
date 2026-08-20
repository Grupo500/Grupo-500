-- Avisos guardados dentro de la app.
--
-- Hasta ahora "te asignaron un trabajo" salia solo como notificacion del
-- navegador: sin permiso concedido, o con el equipo apagado, la persona no se
-- enteraba nunca. El push sigue como refuerzo; esto es lo que queda.

CREATE TYPE "TipoNotificacion" AS ENUM (
  'TAREA_ASIGNADA',
  'CAMBIOS_PEDIDOS',
  'CORRECCION_HECHA',
  'TAREA_PUBLICADA'
);

CREATE TABLE "notificaciones" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "autorId"     TEXT,
  "tipo"        "TipoNotificacion" NOT NULL,
  "texto"       TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "contenidoId" TEXT,
  "leidaEn"     TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- Las dos consultas de la campana: cuantas sin leer, y las ultimas primero.
CREATE INDEX "notificaciones_userId_leidaEn_idx"   ON "notificaciones"("userId", "leidaEn");
CREATE INDEX "notificaciones_userId_createdAt_idx" ON "notificaciones"("userId", "createdAt");

ALTER TABLE "notificaciones"
  ADD CONSTRAINT "notificaciones_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Si el autor se borra, el aviso sobrevive sin su foto.
ALTER TABLE "notificaciones"
  ADD CONSTRAINT "notificaciones_autorId_fkey"
  FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
