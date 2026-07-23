-- CreateTable
CREATE TABLE "brito_lecciones" (
    "id" TEXT NOT NULL,
    "materia" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brito_lecciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brito_leccion_preguntas" (
    "leccionId" TEXT NOT NULL,
    "preguntaId" BIGINT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "brito_leccion_preguntas_pkey" PRIMARY KEY ("leccionId","preguntaId")
);

-- CreateTable
CREATE TABLE "brito_perfiles" (
    "id" TEXT NOT NULL,
    "estudianteId" UUID NOT NULL,
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "corazones" INTEGER NOT NULL DEFAULT 5,
    "corazonesAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rachaActual" INTEGER NOT NULL DEFAULT 0,
    "rachaMejor" INTEGER NOT NULL DEFAULT 0,
    "ultimaLeccionAt" TIMESTAMP(3),
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brito_perfiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brito_lecciones_completadas" (
    "id" TEXT NOT NULL,
    "estudianteId" UUID NOT NULL,
    "leccionId" TEXT NOT NULL,
    "correctas" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "xpGanado" INTEGER NOT NULL,
    "completadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brito_lecciones_completadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brito_perfiles_estudianteId_key" ON "brito_perfiles"("estudianteId");

-- CreateIndex
CREATE INDEX "brito_lecciones_completadas_estudianteId_leccionId_idx" ON "brito_lecciones_completadas"("estudianteId", "leccionId");

-- AddForeignKey
ALTER TABLE "brito_leccion_preguntas" ADD CONSTRAINT "brito_leccion_preguntas_leccionId_fkey" FOREIGN KEY ("leccionId") REFERENCES "brito_lecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brito_leccion_preguntas" ADD CONSTRAINT "brito_leccion_preguntas_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "sim_preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brito_perfiles" ADD CONSTRAINT "brito_perfiles_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "sim_estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brito_lecciones_completadas" ADD CONSTRAINT "brito_lecciones_completadas_leccionId_fkey" FOREIGN KEY ("leccionId") REFERENCES "brito_lecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
