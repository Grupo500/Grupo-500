-- Renombrar contactId -> ticketId: los leads de HubSpot en realidad
-- vienen de Tickets (conversaciones autoasignadas), no de Contactos.
ALTER TABLE "HubspotLead" RENAME COLUMN "contactId" TO "ticketId";
