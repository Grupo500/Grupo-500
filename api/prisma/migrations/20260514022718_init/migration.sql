-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA', 'TARJETA', 'EFECTIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoFinanciamiento" AS ENUM ('ACTIVO', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('CURSANDO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "RendimientoEstudiante" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VENDEDOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asesor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colegio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colegio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudiante" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "colegioId" TEXT,
    "asesorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acudiente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "relacion" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,

    CONSTRAINT "Acudiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DOUBLE PRECISION NOT NULL,
    "duracionDias" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoEstudiante" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursoEstudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "asesorId" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "metodo" "MetodoPago" NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "comprobante" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Financiamiento" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoFinanciamiento" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Financiamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "financiamientoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderCobro" (
    "id" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3),
    "numeroIntento" INTEGER NOT NULL DEFAULT 0,
    "mensajeEnviado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderCobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" "TipoCertificado" NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiracion" TIMESTAMP(3),

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulacro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simulacro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulacroEstudiante" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "simulacroId" TEXT NOT NULL,
    "puntajeTotal" INTEGER NOT NULL,
    "porcentajeAciertos" DOUBLE PRECISION NOT NULL,
    "areasDebiles" TEXT[],
    "rendimiento" "RendimientoEstudiante" NOT NULL,
    "requiereIntensivo" BOOLEAN NOT NULL DEFAULT false,
    "fechaAnalisis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulacroEstudiante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Asesor_userId_key" ON "Asesor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Colegio_nombre_key" ON "Colegio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Acudiente_estudianteId_key" ON "Acudiente"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "CursoEstudiante_estudianteId_cursoId_key" ON "CursoEstudiante"("estudianteId", "cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_numeroSerie_key" ON "Certificado"("numeroSerie");

-- CreateIndex
CREATE UNIQUE INDEX "SimulacroEstudiante_estudianteId_simulacroId_key" ON "SimulacroEstudiante"("estudianteId", "simulacroId");

-- AddForeignKey
ALTER TABLE "Asesor" ADD CONSTRAINT "Asesor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_colegioId_fkey" FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Asesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acudiente" ADD CONSTRAINT "Acudiente_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoEstudiante" ADD CONSTRAINT "CursoEstudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoEstudiante" ADD CONSTRAINT "CursoEstudiante_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Asesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financiamiento" ADD CONSTRAINT "Financiamiento_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_financiamientoId_fkey" FOREIGN KEY ("financiamientoId") REFERENCES "Financiamiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderCobro" ADD CONSTRAINT "ReminderCobro_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulacroEstudiante" ADD CONSTRAINT "SimulacroEstudiante_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulacroEstudiante" ADD CONSTRAINT "SimulacroEstudiante_simulacroId_fkey" FOREIGN KEY ("simulacroId") REFERENCES "Simulacro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
