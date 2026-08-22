-- CreateTable
CREATE TABLE "marketing_apuntes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT '',
    "contenido" TEXT NOT NULL DEFAULT '',
    "etiqueta" TEXT,
    "color" TEXT,
    "fijado" BOOLEAN NOT NULL DEFAULT false,
    "archivadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_apuntes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_apuntes_compartidos" (
    "id" TEXT NOT NULL,
    "apunteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puedeEditar" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_apuntes_compartidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_apuntes_userId_updatedAt_idx" ON "marketing_apuntes"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_apuntes_compartidos_apunteId_userId_key" ON "marketing_apuntes_compartidos"("apunteId", "userId");

-- AddForeignKey
ALTER TABLE "marketing_apuntes" ADD CONSTRAINT "marketing_apuntes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_apuntes_compartidos" ADD CONSTRAINT "marketing_apuntes_compartidos_apunteId_fkey" FOREIGN KEY ("apunteId") REFERENCES "marketing_apuntes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_apuntes_compartidos" ADD CONSTRAINT "marketing_apuntes_compartidos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

