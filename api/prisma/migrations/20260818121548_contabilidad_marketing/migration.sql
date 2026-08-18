-- CreateTable
CREATE TABLE "contab_departamentos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "gradiente" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "esBase" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contab_departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contab_personas" (
    "id" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT,
    "rol_texto" TEXT,
    "foto_url" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contab_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contab_registros" (
    "id" BIGSERIAL NOT NULL,
    "persona_id" TEXT NOT NULL,
    "quincena" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "actividad" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "link" TEXT,
    "imagen_url" TEXT,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "rechazado" BOOLEAN NOT NULL DEFAULT false,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contab_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contab_envios" (
    "id" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,
    "quincena" TEXT NOT NULL,
    "enviado_at" TIMESTAMP(3) NOT NULL,
    "por" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "personas" INTEGER NOT NULL,

    CONSTRAINT "contab_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contab_tarifas" (
    "id" TEXT NOT NULL,
    "dept_id" TEXT,
    "label" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "contab_tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contab_categorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contab_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contab_personas_dept_id_slug_key" ON "contab_personas"("dept_id", "slug");

-- CreateIndex
CREATE INDEX "contab_registros_quincena_idx" ON "contab_registros"("quincena");

-- CreateIndex
CREATE INDEX "contab_registros_persona_id_quincena_idx" ON "contab_registros"("persona_id", "quincena");

-- CreateIndex
CREATE UNIQUE INDEX "contab_envios_dept_id_quincena_key" ON "contab_envios"("dept_id", "quincena");

-- CreateIndex
CREATE UNIQUE INDEX "contab_categorias_nombre_key" ON "contab_categorias"("nombre");

-- AddForeignKey
ALTER TABLE "contab_personas" ADD CONSTRAINT "contab_personas_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "contab_departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contab_registros" ADD CONSTRAINT "contab_registros_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "contab_personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contab_envios" ADD CONSTRAINT "contab_envios_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "contab_departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contab_tarifas" ADD CONSTRAINT "contab_tarifas_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "contab_departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

