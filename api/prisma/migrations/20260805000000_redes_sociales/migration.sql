-- CreateEnum
CREATE TYPE "RedSocialPlataforma" AS ENUM ('INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "TipoPublicacionRed" AS ENUM ('POST', 'HISTORIA', 'REEL');

-- CreateEnum
CREATE TYPE "EstadoPublicacionRed" AS ENUM ('PROGRAMADA', 'PUBLICANDO', 'PUBLICADA', 'ERROR', 'CANCELADA');

-- CreateTable
CREATE TABLE "redes_cuentas" (
    "id" TEXT NOT NULL,
    "plataforma" "RedSocialPlataforma" NOT NULL,
    "nombre" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redes_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redes_publicaciones" (
    "id" TEXT NOT NULL,
    "tipo" "TipoPublicacionRed" NOT NULL,
    "caption" TEXT,
    "mediaUrl" TEXT,
    "mediaEsVideo" BOOLEAN NOT NULL DEFAULT false,
    "programadaPara" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPublicacionRed" NOT NULL DEFAULT 'PROGRAMADA',
    "error" TEXT,
    "externalId" TEXT,
    "publicadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "creadaPorId" TEXT,

    CONSTRAINT "redes_publicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redes_cuentas_plataforma_externalId_key" ON "redes_cuentas"("plataforma", "externalId");

-- CreateIndex
CREATE INDEX "redes_publicaciones_estado_programadaPara_idx" ON "redes_publicaciones"("estado", "programadaPara");

-- AddForeignKey
ALTER TABLE "redes_publicaciones" ADD CONSTRAINT "redes_publicaciones_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "redes_cuentas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
