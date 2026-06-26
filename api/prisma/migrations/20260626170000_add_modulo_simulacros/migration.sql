-- Módulo Simulacros (motor de examen online) migrado desde simulacros-grupo500 (Supabase).
-- Aditivo: solo crea tablas nuevas sim_*; no modifica tablas existentes.

-- CreateTable
CREATE TABLE "sim_simulacros" (
    "id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "abre_at" TIMESTAMP(3),
    "cierra_at" TIMESTAMP(3),
    "duracion_min" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sim_simulacros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_preguntas" (
    "id" BIGSERIAL NOT NULL,
    "simulacro_id" INTEGER NOT NULL,
    "sesion" INTEGER NOT NULL,
    "area" TEXT,
    "numero" INTEGER,
    "contexto" TEXT,
    "enunciado" TEXT NOT NULL,
    "opcion_a" TEXT,
    "opcion_b" TEXT,
    "opcion_c" TEXT,
    "opcion_d" TEXT,
    "correcta" CHAR(1) NOT NULL,
    "explicacion" TEXT,
    "imagen_url" TEXT,
    "tiene_imagen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sim_preguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_estudiantes" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "documento_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "colegio_id" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_intentos" (
    "id" BIGSERIAL NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "simulacro_id" INTEGER NOT NULL,
    "respuestas" JSONB NOT NULL DEFAULT '{}',
    "correctas" INTEGER,
    "total" INTEGER,
    "puntaje" DECIMAL,
    "sesion_actual" INTEGER NOT NULL DEFAULT 1,
    "iniciado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_at" TIMESTAMP(3),

    CONSTRAINT "sim_intentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sim_preguntas_simulacro_id_sesion_numero_idx" ON "sim_preguntas"("simulacro_id", "sesion", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "sim_estudiantes_email_key" ON "sim_estudiantes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sim_intentos_estudiante_id_simulacro_id_key" ON "sim_intentos"("estudiante_id", "simulacro_id");

-- AddForeignKey
ALTER TABLE "sim_preguntas" ADD CONSTRAINT "sim_preguntas_simulacro_id_fkey" FOREIGN KEY ("simulacro_id") REFERENCES "sim_simulacros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_estudiantes" ADD CONSTRAINT "sim_estudiantes_colegio_id_fkey" FOREIGN KEY ("colegio_id") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_intentos" ADD CONSTRAINT "sim_intentos_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "sim_estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_intentos" ADD CONSTRAINT "sim_intentos_simulacro_id_fkey" FOREIGN KEY ("simulacro_id") REFERENCES "sim_simulacros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
