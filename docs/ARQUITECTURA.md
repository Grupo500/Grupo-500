# Arquitectura de Grupo 500

> Última actualización: 2026-07-31 (sesión de auditoría de documentación). Ver `docs/SESIONES/historial.md` para el detalle sesión por sesión de cómo se llegó aquí.

## Visión General

Grupo 500 es una plataforma monorepo con frontend (Next.js) y backend (Express) separados, más un canal de eventos en tiempo real vía SSE. Usa PostgreSQL con Prisma ORM y autenticación **NextAuth v5** (no Clerk — la migración se hizo en la sesión 005 y no queda ninguna referencia a Clerk en el código).

```
Cliente (Browser / apps móviles Capacitor)
     ↓                        ↑
  Next.js (Vercel)      SSE (text/event-stream, /api/eventos)
     ↓                        ↑
  Express API (Railway) ──────┘
     ↓
  PostgreSQL (Neon)
```

## Stack

### Frontend (`web/`)
- **Next.js 15** App Router + TypeScript
- **Tailwind CSS + shadcn/ui** — sistema de diseño propio documentado en `DESIGN.md` (raíz del repo)
- **NextAuth v5** (`@auth/prisma-adapter`) — Credentials (email/password con bcrypt) + Google OAuth + WebAuthn/passkeys (Face ID / Touch ID vía `@simplewebauthn/browser`)
- **TanStack Query** para estado servidor, con invalidación disparada por eventos SSE
- **Recharts** para gráficas del dashboard, reportes y finanzas
- **jsPDF** para certificados, **react-pdf** para el visor de T&C en móvil
- **Cloudinary SDK** para assets (comprobantes, certificados, imágenes de preguntas)
- **GSAP + Three.js (`@react-three/fiber`, `@react-three/drei`)** — hero 3D animado en `/inscripcion`
- **Sentry (`@sentry/nextjs`)** para error tracking
- Fuente única: **Poppins** en toda la plataforma, incluido el juego Brito

### Backend (`api/`)
- **Express.js** con TypeScript
- **Prisma ORM** sobre PostgreSQL
- **`jsonwebtoken`** — verifica el JWT firmado por NextAuth (`NEXTAUTH_SECRET`), no hay SDK de Clerk
- **Zod** para validación de inputs
- **Multer** para uploads (incluye `uploadExcel` con memoryStorage para importaciones)
- **Sentry (`@sentry/node`)** para error tracking, con `setupExpressErrorHandler`
- **Helmet** con CSP explícito (sin defaults) + **express-rate-limit** en dos capas (global por IP + por usuario autenticado)
- **pino** para logging estructurado, con `reqId` (correlation id) por request
- **SSE nativo** (sin librería — `res.write` con `text/event-stream`) para tiempo real, ver sección dedicada abajo
- Jobs en background con `setTimeout`/`setInterval` (no hay cola tipo Bull — se descartó, nunca llegó a usarse)

### Mobile (`mobile/`)
- **Capacitor** envolviendo el frontend web para publicar en Google Play y App Store (agregado 2026-07-21). Ver `docs/APP_STORES.md`.

### Infraestructura
- **PostgreSQL** en **Neon**
- **Cloudinary** para almacenamiento de assets
- **Railway** para el backend (`api/`), auto-deploy al hacer push a `main`
- **Vercel** para el frontend (`web/`), auto-deploy al hacer push a `main`
- Sin GitHub Actions / CI configurado — la verificación es `tsc --noEmit` + build local antes de cada push, directo a producción
- **No hay ambiente de staging**: los cambios se prueban con typecheck/build y se lanzan a producción

### Lo que estaba planeado y nunca se construyó (o se construyó y se eliminó después)
- **Twilio / SendGrid / Bull Queue**: nunca se agregaron como dependencia real, ni en `api/package.json` ni en `web/package.json`.
- **WhatsApp, Financiamientos, Cuotas, Cobros/calendario**: existieron en las primeras sesiones y se **eliminaron por completo** el 2026-06-15 (commit "eliminar financiamientos/cuotas/cobros, whatsapp-recordatorios, marketing y demografía"). El negocio migró a que Hotmart procese los pagos/cuotas y la app solo registra y muestra ese estado — ver modelo `Pago` (campos `enPartes`, `cuotaNumero`, `cuotasTotal`) en vez de un modelo `Financiamiento`/`Cuota` separado.
- **Clerk**: reemplazado por NextAuth en la sesión 005 (2026-05-21). No queda ninguna dependencia ni referencia.
- **Typeform / HubSpot como fuente de inscripción**: Typeform se usó brevemente y se eliminó al integrar Hotmart directo (2026-06-12). HubSpot se mantiene, pero solo como **fuente de leads** para medir tasa de cierre de asesores (vía Tickets, no Contactos), no como parte del flujo de inscripción.

## Base de Datos (Prisma Schema)

### Entidades del núcleo de ventas

```
User (NextAuth: Credentials + Google OAuth + Passkeys)
├── Asesor (1:1) — vendedor; emailCrm para homologar leads externos
│   ├── Estudiante[]
│   ├── Pago[]
│   ├── Negociacion[] (pipeline de convenios con colegios)
│   └── AliasAsesor[] (homologa nombres de afiliado Hotmart)
├── Estudiante
│   ├── Acudiente (1:1)
│   ├── CursoEstudiante → Curso (M:M)
│   ├── Pago (1:M) — con desglose de comisiones (comisionHotmart, comisionAsesor, montoNeto, trm)
│   ├── Certificado (1:M)
│   ├── HistorialEstudiante (1:M) — auditoría de cambios
│   ├── Observacion (1:M)
│   └── FuenteContacto (1:1)
└── Colegio
```

### Motor de exámenes (`sim_*`, prefijo aparte a propósito)

Migrado desde una app Supabase separada (`simulacros-grupo500`). **No confundir con el modelo `Simulacro` del núcleo de ventas** (análisis de PDFs subidos, otra cosa completamente distinta que sigue existiendo aparte).

```
Examen (sim_simulacros)
├── PreguntaExamen (sim_preguntas) — opciones A-H, imagen opcional
└── IntentoExamen (sim_intentos) ← EstudianteExamen (sim_estudiantes, NO es el Estudiante de ventas)
```

`EstudianteExamen` tiene su propio login (único para todos, en `/sign-in`) y queda fuera del muro de acceso del backoffice de ventas — un usuario con rol `ESTUDIANTE` se redirige directo a `/examenes`.

### Brito — gamificación (capa nueva sobre el motor de exámenes)

```
BritoPerfil (1:1 con EstudianteExamen) — xp, corazones, racha, liga, quinis (moneda del juego)
BritoLeccion → BritoLeccionPregunta → PreguntaExamen (reutiliza el banco de preguntas)
BritoGrupoLiga → BritoMiembroLiga (ligas semanales con ascenso/descenso)
BritoLeccionCompletada
```

### Finanzas (`finanzas_*`, módulo ADMIN-only)

```
InversionPublicitaria — gasto por plataforma/campaña/período (Google Ads automatizado cada 4h vía API; Meta/TikTok aún manual)
PrecioOficial — histórico de precios por curso, append-only (nunca se edita una fila vieja)
ParametroFinanzas — config clave-valor (umbrales, fechas)
AliasAsesor — homologación de nombre de afiliado Hotmart → Asesor
```

### Integraciones registradas aparte

```
HotmartWebhookLog — copia cruda de cada postback de Hotmart (auditoría)
TrengoTicket — conversaciones asignadas a un asesor (leads)
HubspotLead — Tickets de HubSpot asignados a un owner (leads)
```

### Roles

Tres roles, no dos: **`ADMIN`**, **`VENDEDOR`** (ambos ven el backoffice de ventas/finanzas) y **`ESTUDIANTE`** (solo ve `/examenes` y Brito — nunca el backoffice). Finanzas es exclusivo de `ADMIN`.

## Tiempo real (SSE)

No hay WebSockets ni librería externa: es Server-Sent Events nativo de Express.

- `GET /api/eventos?token=<jwt>` — el token va como query param porque SSE no soporta headers custom; se valida con `jsonwebtoken` contra `NEXTAUTH_SECRET`.
- `api/src/utils/sseManager.ts` — `addClient`/`removeClient`/`broadcast(evento, data)`.
- Ping cada 20s para mantener viva la conexión en Railway (timeout de 300s).
- `SSEProvider.tsx` (frontend, `'use client'`) envuelve el layout del dashboard; `useSSE.ts` invalida queries de TanStack Query según el evento recibido.
- Disparan `broadcast()`: registrar/actualizar pago, actualizar cuota, nueva inscripción pública, webhook de compra de Hotmart, ranking de asesores.
- **Pendiente conocido:** el broadcast es global — todo cliente conectado recibe todo. Falta filtrar por `asesorId`.

## API — módulos montados en `api/src/index.ts`

```
/api/auth              /api/estudiantes        /api/asesores
/api/cursos             /api/colegios            /api/pagos
/api/certificados       /api/simulacros          /api/reportes   (UI: "Analíticas")
/api/finanzas           /api/upload              /api/config
/api/negociaciones      /api/inscripcion         /api/formularios
/api/eventos (SSE)      /api/passkeys            /api/hotmart
/api/notificaciones     /api/trengo              /api/hubspot
/api/apikeys            /api/public/v1 (API pública de solo lectura, ver docs/API_PUBLICA.md)
/api/webhooks
```

No existen (fueron eliminados): `/financiamientos`, `/cuotas`, `/cobros`, `/whatsapp`. `docs/API.md` todavía los documenta — está desactualizado, no seguirlo sin verificar contra las rutas reales arriba.

## Flujos Principales

### 1. Compra de curso (real, vía Hotmart)

```
Estudiante compra en checkout de Hotmart
    ↓ (webhook)
POST /api/hotmart/webhook → crea/actualiza Estudiante + Pago + CursoEstudiante
    ↓
Asesor identificado por código de rastreo (src/sck) o alias de afiliado homologado
    ↓
Si es pago en partes (Smart Installment) → Pago con enPartes=true, cuotaNumero/cuotasTotal
    ↓
Broadcast SSE → dashboard se actualiza sin refresh
```

### 2. Inscripción manual vía formulario propio

```
Asesor genera su link personalizado (?asesor=ID) desde /dashboard/formularios
    ↓
Estudiante llena el formulario dinámico (Formulario en BD, sin constructor visual — se edita por script)
    ↓
POST /api/inscripcion/publica → crea Estudiante + Acudiente + Pago con método/referencia
    ↓
Broadcast SSE (incluye asesorId + curso)
    ↓
Admin/Asesor confirma matrícula manualmente
```

### 3. Leads y tasa de cierre

```
Lead llega por Trengo (WhatsApp) o HubSpot (Tickets, no Contactos)
    ↓
Se cruza por email del "owner"/agente contra Asesor.emailCrm (o Asesor.email si no tiene emailCrm)
    ↓
Tasa de cierre = ventas del asesor / leads asignados, mostrada en ranking de Analíticas
```

### 4. Motor de examen / Brito

```
EstudianteExamen inicia sesión (login único en /sign-in)
    ↓
/examenes → toma un Examen real (sim_*) con cronómetro de 4:30h por sesión
    o
/brito → practica lecciones gamificadas del banco de preguntas, gana XP/quinis, compite en ligas semanales
```

## Seguridad

- **Autenticación:** NextAuth v5 — Credentials (bcrypt) + Google OAuth + WebAuthn/passkeys. JWT propio (firmado con `NEXTAUTH_SECRET`) para que los Client Components llamen al Express API.
- **Autorización:** `requireRole()` por endpoint; scoping por `asesorId` donde aplica (ej. VENDEDOR solo ve sus negociaciones).
- **Validación:** Zod en cada input del backend.
- **CORS:** valida el origen dinámicamente contra `ALLOWED_ORIGINS`.
- **CSP:** explícito vía Helmet, sin wildcards; `frameAncestors: 'none'`.
- **Rate limiting:** dos capas (global 200/15min por IP, 60/min por usuario autenticado).
- **API pública:** `ApiKey` con hash + scopes + revocación, para `/api/public/v1` (ver `docs/API_PUBLICA.md`).
- **Auditoría:** `HotmartWebhookLog` guarda cada postback crudo; `HistorialEstudiante` registra cambios con `realizadoPor`.

## Performance

- **Caching:** TanStack Query en frontend, con `staleTime` largo en queries secundarias (colegios, asesores-select, cursos-select).
- **Paginación:** en listados grandes.
- **Compresión:** `compression` middleware en Express.
- **CDN:** Cloudinary para assets.

## Deployment

- **Frontend:** Vercel, push a `main` → auto deploy. `vercel.json` incluye `prisma generate` en el build.
- **Backend:** Railway, push a `main` → auto deploy.
- **DB:** Neon, migraciones con `prisma migrate deploy`.
- **Mobile:** Capacitor (`mobile/`), build separado para Google Play / App Store — ver `docs/APP_STORES.md`.
- **Regla del repo:** commit local siempre, `push` solo cuando el usuario lo pide explícitamente (dos personas trabajan el mismo `main`).

## Futuro / pendientes conocidos

- [ ] Filtrar el broadcast SSE por `asesorId` (hoy es global)
- [ ] Meta y TikTok en `InversionPublicitaria` (Google Ads ya automatizado)
- [ ] Acceso básico del developer token de Google Ads (hoy en nivel Explorador, con techo de cuota)
- [ ] Exportar reportes CSV/PDF
- [ ] Rediseño corporativo de todos los módulos en Stitch (empezó por Ventas) — ver memoria de sesión
