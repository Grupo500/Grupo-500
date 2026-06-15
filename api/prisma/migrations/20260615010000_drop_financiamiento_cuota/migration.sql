-- Eliminar el sistema de financiamientos/cuotas/cobros (todas las tablas vacías)
DROP TABLE IF EXISTS "ReminderCobro";
DROP TABLE IF EXISTS "Cuota";
DROP TABLE IF EXISTS "Financiamiento";
DROP TYPE IF EXISTS "EstadoFinanciamiento";
