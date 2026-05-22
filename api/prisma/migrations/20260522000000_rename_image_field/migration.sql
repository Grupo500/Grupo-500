-- Renombrar imageUrl a image en tabla User
-- Preserva los datos existentes
ALTER TABLE "User" RENAME COLUMN "imageUrl" TO "image";
