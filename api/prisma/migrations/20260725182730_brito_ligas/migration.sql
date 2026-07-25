-- AlterTable
ALTER TABLE "brito_perfiles" ADD COLUMN     "liga" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ligaSemana" TEXT,
ADD COLUMN     "semanasInactivas" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "brito_grupos_liga" (
    "id" TEXT NOT NULL,
    "liga" INTEGER NOT NULL,
    "semana" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brito_grupos_liga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brito_miembros_liga" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "estudianteId" UUID NOT NULL,
    "xpSemana" INTEGER NOT NULL DEFAULT 0,
    "resultado" TEXT,

    CONSTRAINT "brito_miembros_liga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brito_grupos_liga_liga_semana_idx" ON "brito_grupos_liga"("liga", "semana");

-- CreateIndex
CREATE INDEX "brito_miembros_liga_estudianteId_idx" ON "brito_miembros_liga"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "brito_miembros_liga_grupoId_estudianteId_key" ON "brito_miembros_liga"("grupoId", "estudianteId");

-- AddForeignKey
ALTER TABLE "brito_miembros_liga" ADD CONSTRAINT "brito_miembros_liga_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "brito_grupos_liga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
