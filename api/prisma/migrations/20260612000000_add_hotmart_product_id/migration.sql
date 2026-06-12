-- AlterTable
ALTER TABLE "Curso" ADD COLUMN "hotmartProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Curso_hotmartProductId_key" ON "Curso"("hotmartProductId");
