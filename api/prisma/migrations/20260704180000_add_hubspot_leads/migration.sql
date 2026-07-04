-- CreateTable
CREATE TABLE "HubspotLead" (
    "contactId" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "createdAtHubspot" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubspotLead_pkey" PRIMARY KEY ("contactId")
);

-- CreateIndex
CREATE INDEX "HubspotLead_ownerEmail_idx" ON "HubspotLead"("ownerEmail");

-- CreateIndex
CREATE INDEX "HubspotLead_createdAtHubspot_idx" ON "HubspotLead"("createdAtHubspot");
