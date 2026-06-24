-- CreateTable
CREATE TABLE "TrengoTicket" (
    "ticketId" TEXT NOT NULL,
    "agentEmail" TEXT NOT NULL,
    "firstAssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrengoTicket_pkey" PRIMARY KEY ("ticketId")
);

-- CreateIndex
CREATE INDEX "TrengoTicket_agentEmail_idx" ON "TrengoTicket"("agentEmail");

-- CreateIndex
CREATE INDEX "TrengoTicket_firstAssignedAt_idx" ON "TrengoTicket"("firstAssignedAt");
