-- CreateTable
CREATE TABLE "sesiones_activas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "navegador" TEXT,
    "dispositivo" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "sesiones_activas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_activas_sid_key" ON "sesiones_activas"("sid");

-- CreateIndex
CREATE INDEX "sesiones_activas_userId_cerradaEn_idx" ON "sesiones_activas"("userId", "cerradaEn");

-- AddForeignKey
ALTER TABLE "sesiones_activas" ADD CONSTRAINT "sesiones_activas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

