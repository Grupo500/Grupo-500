-- CreateEnum
CREATE TYPE "TipoContenidoMarketing" AS ENUM ('VIDEO', 'GUION', 'PUBLICACION', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoContenidoMarketing" AS ENUM ('PLANIFICADO', 'EN_PROCESO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "PlataformaEntregable" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'DRIVE', 'OTRO');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MARKETING';

-- CreateTable
CREATE TABLE "marketing_miembros" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_miembros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_contenidos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoContenidoMarketing" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoContenidoMarketing" NOT NULL DEFAULT 'PLANIFICADO',
    "notas" TEXT,
    "asignadoAId" TEXT,
    "guionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_contenidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_entregables" (
    "id" TEXT NOT NULL,
    "contenidoId" TEXT NOT NULL,
    "plataforma" "PlataformaEntregable" NOT NULL,
    "url" TEXT,
    "videoUrl" TEXT,
    "publicadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_entregables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_guiones" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_guiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_miembros_userId_key" ON "marketing_miembros"("userId");

-- AddForeignKey
ALTER TABLE "marketing_miembros" ADD CONSTRAINT "marketing_miembros_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_contenidos" ADD CONSTRAINT "marketing_contenidos_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "marketing_miembros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_contenidos" ADD CONSTRAINT "marketing_contenidos_guionId_fkey" FOREIGN KEY ("guionId") REFERENCES "marketing_guiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_entregables" ADD CONSTRAINT "marketing_entregables_contenidoId_fkey" FOREIGN KEY ("contenidoId") REFERENCES "marketing_contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_guiones" ADD CONSTRAINT "marketing_guiones_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "marketing_miembros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
