-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "Acudiente" ADD COLUMN     "numeroDocumento" TEXT,
ADD COLUMN     "tipoDocumento" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Estudiante" ADD COLUMN     "carreraInteres" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "grado" TEXT,
ADD COLUMN     "interesPremedico" TEXT,
ADD COLUMN     "primerIcfes" BOOLEAN DEFAULT true,
ADD COLUMN     "puntajeAnterior" TEXT,
ADD COLUMN     "universidadInteres" TEXT,
ALTER COLUMN "tipoDocumento" SET DEFAULT 'TI';

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerificationToken" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FuenteContacto" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "formId" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuenteContacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuenteContacto_estudianteId_key" ON "FuenteContacto"("estudianteId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuenteContacto" ADD CONSTRAINT "FuenteContacto_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
