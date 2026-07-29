-- CreateTable
CREATE TABLE "finanzas_inversion_publicitaria" (
    "id" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "campania" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "gastoCOP" DOUBLE PRECISION NOT NULL,
    "impresiones" INTEGER NOT NULL DEFAULT 0,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "conversiones" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finanzas_inversion_publicitaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finanzas_precios_oficiales" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finanzas_precios_oficiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finanzas_parametros" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finanzas_parametros_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "finanzas_inversion_publicitaria_plataforma_desde_hasta_idx" ON "finanzas_inversion_publicitaria"("plataforma", "desde", "hasta");

-- CreateIndex
CREATE INDEX "finanzas_precios_oficiales_cursoId_vigenteDesde_idx" ON "finanzas_precios_oficiales"("cursoId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "finanzas_precios_oficiales_cursoId_vigenteDesde_key" ON "finanzas_precios_oficiales"("cursoId", "vigenteDesde");

-- AddForeignKey
ALTER TABLE "finanzas_precios_oficiales" ADD CONSTRAINT "finanzas_precios_oficiales_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
