-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "horarioTexto" TEXT,
ADD COLUMN     "materias" TEXT[] DEFAULT ARRAY[]::TEXT[];
