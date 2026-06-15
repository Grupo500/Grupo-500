// Fija la zona horaria del proceso a Colombia (UTC-5) ANTES de cualquier
// operación con fechas. Así el agrupamiento por día (gráficas, ranking,
// filtros diarios) usa los límites del día en hora de Colombia y no en UTC.
//
// Debe importarse como PRIMERA línea del entrypoint para garantizar que
// se ejecuta antes de que se cree cualquier Date.
//
// Nota: lo ideal es además definir TZ=America/Bogota en las variables de
// entorno de Railway; esto es la red de seguridad si no está definida.
if (!process.env.TZ) {
  process.env.TZ = 'America/Bogota'
}

export {}
