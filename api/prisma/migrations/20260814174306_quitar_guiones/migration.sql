/*
  Warnings:

  - You are about to drop the column `guionId` on the `marketing_contenidos` table. All the data in the column will be lost.
  - You are about to drop the `marketing_guiones` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "marketing_contenidos" DROP CONSTRAINT "marketing_contenidos_guionId_fkey";

-- DropForeignKey
ALTER TABLE "marketing_guiones" DROP CONSTRAINT "marketing_guiones_autorId_fkey";

-- AlterTable
ALTER TABLE "marketing_contenidos" DROP COLUMN "guionId";

-- DropTable
DROP TABLE "marketing_guiones";
