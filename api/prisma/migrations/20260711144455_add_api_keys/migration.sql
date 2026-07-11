-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "scopes" TEXT[],
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "ultimoUso" TIMESTAMP(3),
    "creadaPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadaAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
