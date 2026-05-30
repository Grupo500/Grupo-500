-- CreateTable
CREATE TABLE "Formulario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "campos" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "visibleEnLanding" BOOLEAN NOT NULL DEFAULT false,
    "cursoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formulario_pkey" PRIMARY KEY ("id")
);
