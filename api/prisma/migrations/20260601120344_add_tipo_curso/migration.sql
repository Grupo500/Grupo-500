-- CreateEnum
CREATE TYPE "TipoCurso" AS ENUM ('INDIVIDUAL', 'COMBO');

-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "tipoCurso" "TipoCurso" NOT NULL DEFAULT 'INDIVIDUAL';
