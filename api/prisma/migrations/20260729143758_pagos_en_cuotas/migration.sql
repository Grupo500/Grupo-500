-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "cuotaNumero" INTEGER,
ADD COLUMN     "cuotasTotal" INTEGER,
ADD COLUMN     "enPartes" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "hotmart_webhook_logs" (
    "id" TEXT NOT NULL,
    "evento" TEXT,
    "transaccion" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotmart_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotmart_webhook_logs_transaccion_idx" ON "hotmart_webhook_logs"("transaccion");

-- CreateIndex
CREATE INDEX "hotmart_webhook_logs_createdAt_idx" ON "hotmart_webhook_logs"("createdAt");
