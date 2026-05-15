-- CreateEnum
CREATE TYPE "CalendarioCurso" AS ENUM ('A', 'B');

-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "calendario" "CalendarioCurso" NOT NULL DEFAULT 'A';
