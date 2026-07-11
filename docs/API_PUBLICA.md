# API pública (solo lectura)

Base URL: `https://api-production-79572.up.railway.app/api/public/v1`

Pensada para integraciones externas (IA, Zapier, dashboards de terceros). Solo permite **leer** datos — ningún endpoint crea, edita ni borra información.

## Autenticación

Cada integración tiene su propia API key, emitida desde el panel **API Keys** (solo visible para administradores en la app).

Envía la key en cualquiera de estos headers:

```
X-API-Key: g500_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
o
```
Authorization: Bearer g500_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Una key inválida o revocada responde `401`. El límite de uso es de **30 solicitudes por minuto** por key.

## Endpoints

### `GET /estudiantes`
Lista paginada de estudiantes.

Query params: `page`, `limit` (máx. 100), `nombre` (búsqueda parcial).

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "nombre": "...",
      "email": "...",
      "verificado": true,
      "createdAt": "...",
      "cursos": [{ "curso": { "nombre": "..." }, "fechaCompra": "..." }],
      "asesor": { "nombre": "..." }
    }
  ],
  "pagination": { "total": 0, "page": 1, "limit": 20, "totalPages": 0, "hasNext": false, "hasPrev": false }
}
```

### `GET /pagos`
Lista paginada de pagos/ventas.

Query params: `page`, `limit`, `estado` (`PENDIENTE`|`PAGADO`|`VENCIDO`|`CANCELADO`), `desde`/`hasta` (ISO, filtran por `fechaPago`).

### `GET /cursos`
Catálogo de cursos activos (sin paginar).

### `GET /reportes/resumen`
KPIs agregados: total de estudiantes, ventas del mes en curso (total y cantidad), pagos pendientes.

## Notas

- No se exponen campos sensibles (documento, teléfono, comisiones internas del asesor).
- Los datos no están filtrados por asesor — una API key ve todos los registros de la app.
- Para dar de baja una integración, revoca su key desde el panel; deja de funcionar de inmediato.
