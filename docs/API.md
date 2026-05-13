# API Reference - Grupo 500

Base URL: `http://localhost:3001/api` (desarrollo)

Autenticación: `Authorization: Bearer <clerk_token>`

Respuesta estándar:
```json
{ "success": true, "data": {...} }
{ "success": false, "error": "Mensaje de error" }
```

---

## Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/auth/me` | Datos del usuario actual |

---

## Estudiantes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/estudiantes` | Listar (paginado, filtros) |
| POST | `/estudiantes` | Crear estudiante + acudiente |
| GET | `/estudiantes/:id` | Ver detalle |
| PATCH | `/estudiantes/:id` | Actualizar |
| DELETE | `/estudiantes/:id` | Eliminar (solo ADMIN) |
| GET | `/estudiantes/:id/rendimiento` | Historial simulacros |

### Parámetros GET /estudiantes
```
?page=1&limit=20
?nombre=Juan
?colegioId=xxx
?asesorId=xxx
?cursoId=xxx
```

---

## Asesores

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/asesores` | Listar (solo ADMIN) |
| GET | `/asesores/:id/estadisticas` | Ventas y comisiones |

---

## Cursos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/cursos` | Listar cursos |
| POST | `/cursos` | Crear (solo ADMIN) |
| PATCH | `/cursos/:id` | Editar (solo ADMIN) |
| DELETE | `/cursos/:id` | Eliminar (solo ADMIN) |
| POST | `/cursos/asignar` | Asignar curso a estudiante |

---

## Colegios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/colegios` | Listar |
| POST | `/colegios` | Crear |
| PATCH | `/colegios/:id` | Editar |
| DELETE | `/colegios/:id` | Eliminar (solo ADMIN) |

---

## Pagos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/pagos` | Listar (filtros) |
| POST | `/pagos` | Registrar pago |
| PATCH | `/pagos/:id` | Actualizar estado |
| POST | `/pagos/:id/comprobante` | Subir comprobante (Cloudinary) |

### Parámetros GET /pagos
```
?estudianteId=xxx
?asesorId=xxx
?estado=PENDIENTE|PAGADO|VENCIDO
?desde=2026-01-01&hasta=2026-12-31
```

---

## Financiamientos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/financiamientos` | Crear con cuotas automáticas |
| GET | `/financiamientos/:id` | Ver con cuotas |
| PATCH | `/financiamientos/:id` | Actualizar estado |

### Body POST /financiamientos
```json
{
  "estudianteId": "xxx",
  "montoTotal": 500000,
  "numeroCuotas": 3,
  "fechaPrimeraCuota": "2026-06-01"
}
```

## Cuotas

| Método | Ruta | Descripción |
|--------|------|-------------|
| PATCH | `/cuotas/:id` | Marcar pagado / actualizar |

---

## Cobros & Calendario

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/cobros/calendario` | Cuotas por fecha |
| POST | `/cobros/recordatorios` | Crear recordatorio |
| GET | `/cobros/historial-whatsapp` | Log de mensajes |

### Parámetros GET /cobros/calendario
```
?fecha=2026-06-17          # Un día específico
?desde=2026-06-01&hasta=2026-06-30  # Rango
?asesorId=xxx              # Filtrar por asesor
```

---

## WhatsApp

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/whatsapp/enviar` | Enviar recordatorio (stub → log) |
| GET | `/whatsapp/historial` | Historial de mensajes |

### Body POST /whatsapp/enviar
```json
{
  "cuotaId": "xxx",
  "telefono": "+573001234567",
  "mensaje": "Hola {nombre}, tu cuota de ${monto} vence el {fecha}."
}
```

---

## Certificados

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/certificados` | Generar certificado |
| GET | `/certificados/:id` | Descargar PDF |
| GET | `/certificados/estudiante/:id` | Historial del estudiante |

### Body POST /certificados
```json
{
  "estudianteId": "xxx",
  "tipo": "CURSANDO" | "COMPLETADO"
}
```

---

## Simulacros

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/simulacros` | Subir PDF (admin/asesor) |
| GET | `/simulacros` | Listar simulacros |
| POST | `/simulacros/:id/analizar` | Procesar y analizar PDF |
| GET | `/simulacros/:id/resultados` | Ver resultados por estudiante |

---

## Reportes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/reportes/dashboard-admin` | Stats globales |
| GET | `/reportes/ingresos` | Ingresos por periodo |
| GET | `/reportes/asesores` | Ranking de asesores |
| GET | `/reportes/cursos` | Cursos más vendidos |

### Parámetros /reportes/ingresos
```
?periodo=dia|semana|mes
?desde=2026-01-01&hasta=2026-12-31
?cursoId=xxx
?asesorId=xxx
```
