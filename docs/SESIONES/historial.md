# Historial de Sesiones - Grupo 500

---

## Sesión 001 — 2026-05-13

**Objetivo:** Crear plan de estructuración y base del proyecto.

### Lo que se hizo
- Definido el stack completo (Next.js 15, Express, Prisma, Clerk, Neon, Railway, Vercel)
- Creado plan de estructuración con módulos, schema Prisma, fases de implementación
- Creada carpeta del proyecto en `C:\Users\nexco\Documents\GitHub\grupo-500`
- Inicializado repositorio git
- Creados archivos base: CLAUDE.md, README.md, pnpm-workspace.yaml, .gitignore
- Creada documentación inicial: ARQUITECTURA.md, historial.md

### Decisiones tomadas
- **Backend-first:** Todas las APIs antes de tocar UI
- **WhatsApp:** Stub en MVP, Twilio en producción
- **Simulacros:** Admin y Asesor pueden subir PDFs de simulacros
- **Roles:** ADMIN y VENDEDOR

### Pendiente (próxima sesión)
- Crear schema Prisma completo ✅ (completado en sesión 002)
- Setup monorepo con `pnpm init` ✅ (completado en sesión 002)
- Configurar Express + TypeScript (`api/`) ✅ (completado en sesión 002)
- Configurar Next.js 15 (`web/`) — PENDIENTE
- Integrar Clerk — PENDIENTE
- Primera migración de BD — PENDIENTE

---

## Sesión 002 — 2026-05-13

**Objetivo:** Setup completo del backend — monorepo, Express, schema Prisma, todas las APIs.

### Lo que se hizo
- Creado `package.json` raíz del monorepo (pnpm workspaces + concurrently)
- Creado `package.json` del backend con todas las dependencias
- Configurado `tsconfig.json` para Express + TypeScript
- Creado schema Prisma completo con todos los modelos:
  `User`, `Asesor`, `Colegio`, `Estudiante`, `Acudiente`, `Curso`, `CursoEstudiante`,
  `Pago`, `Financiamiento`, `Cuota`, `ReminderCobro`, `Simulacro`, `SimulacroEstudiante`, `Certificado`
- Creada estructura completa `api/src/`:
  - `index.ts` — servidor Express con helmet, cors, rate limiting, compresión
  - `middleware/auth.ts` — validación Clerk + requireRole()
  - `middleware/errorHandler.ts` — error handler global + asyncHandler
  - `utils/errors.ts` — clases de error personalizadas
  - `utils/logger.ts` — logger con pino
  - `utils/response.ts` — ApiResponse helpers
  - `config/prisma.ts` — cliente Prisma singleton
- Creadas **13 rutas** con autenticación y control de roles
- Creados **10 controllers** con lógica real:
  Estudiantes, Pagos, Financiamientos (cuotas automáticas), Cuotas,
  Cobros (calendario por fecha), Reportes (dashboard, ranking), Colegios,
  Cursos, Asesores, Certificados, Simulacros, WhatsApp (stub)

### Decisiones técnicas
- Rate limiting global (200/15min) + estricto en auth (10/hora)
- Financiamiento genera cuotas automáticamente al crear
- Cuota auto-completa financiamiento cuando todas quedan pagadas
- Certificados con número de serie único `G500-TIMESTAMP-RANDOM`
- WhatsApp stub: loguea + guarda en DB, Twilio real después

### Pendiente (próxima sesión)
- Copiar `.env.example` → `.env.local` y configurar variables reales
- `pnpm install` en la raíz
- `prisma migrate dev --name init`
- Setup Next.js 15 en `web/`
- Integrar Clerk en frontend

---

## Sesión 003 — 2026-05-14

**Objetivo:** Construir todo el frontend — UI completa, todos los módulos.

### Lo que se hizo

**Setup frontend:**
- Configurado Next.js 15 + Clerk + TanStack Query en `web/`
- Implementado layout protegido con detección de rol (ADMIN/VENDEDOR)
- Sidebar con navegación por rol, modo oscuro/claro
- Bottom navigation para móvil (4 items primarios + sheet "Más")

**Módulos construidos (UI completa):**
- **Dashboard Admin:** estadísticas, gráficas Recharts, cobros próximos, ranking asesores
- **Dashboard Vendedor:** mis estudiantes, mis pagos, mis cobros próximos
- **Estudiantes:** tabla paginada, búsqueda, CRUD completo, gestión acudiente
- **Pagos:** filtros por estado, registrar pago (+ comprobante URL), marcar pagado
- **Financiamientos:** crear cuotas automáticas, ver estado por cuotas
- **Cobros:** calendario mensual conectado a API real, pagar cuota, WhatsApp desde acudiente
- **Certificados:** tabla, generar certificado, descargar PDF
- **Simulacros:** tabla resultados, modal "Subir simulacro" (nombre + URL)
- **Colegios / Cursos / Reportes / Usuarios:** módulos completos

**Fixes de UX aplicados:**
- `maximumScale: 1` viewport → deshabilita zoom iOS
- Modales `fixed inset-0` backdrop → no muestra app detrás
- Tailwind token `on-primary` → texto blanco en botones primarios light mode
- API `api.ts` maneja 204 No Content en deletes
- `min-h-dvh` en páginas auth → centrado correcto iOS Safari
- Custom `ConfirmDialog` reemplaza `confirm()` nativo
- Bottom nav móvil, sidebar oculto en mobile

### Estado actual
**PLATAFORMA MVP COMPLETA.** Todos los módulos construidos y funcionales.

### Pendiente / Mejoras futuras
- Twilio WhatsApp real (actualmente stub)
- Análisis inteligente PDFs simulacros
- Upload directo Cloudinary desde UI
- Notificaciones automáticas de cobro
- Reportes exportables CSV/PDF

---

---

## Sesión 005 — 2026-05-21

**Objetivo:** Migrar autenticación de Clerk a NextAuth v5 (email/password + Google OAuth). Mejorar estabilidad del build.

### Lo que se hizo

**Migración de auth (Clerk → NextAuth):**
- Eliminado `@clerk/nextjs` completamente del proyecto
- Creado `web/src/auth.config.ts` — configuración edge-compatible con callbacks JWT/session/authorized
- Creado `web/src/auth.ts` — configuración completa con PrismaAdapter, Credentials + Google OAuth providers
- Creado `web/src/lib/prisma.ts` — cliente Prisma singleton para Next.js
- Creado `web/src/app/api/auth/[...nextauth]/route.ts` — handlers de NextAuth
- Creado `web/src/app/api/auth/token/route.ts` — genera JWT firmado para que Client Components llamen al Express API
- Actualizado `web/src/middleware.ts` — usa NextAuth en vez de Clerk para proteger rutas
- Actualizado `web/src/lib/api.server.ts` — genera JWT desde sesión NextAuth para Server Components
- Actualizado `web/src/lib/api.ts` — agrega `getClientToken()` para Client Components
- Creado `web/src/types/next-auth.d.ts` — extiende tipos de sesión con `role`
- Creado `web/src/components/layout/UserMenu.tsx` — reemplaza `UserButton` de Clerk con dropdown personalizado
- Nueva página de sign-in: formulario email/password + botón Google OAuth estilizados
- Página sign-up redirige a sign-in (registro gestionado por admin)
- Actualizado `verificando/page.tsx` — usa `useSession` en lugar de `useAuth`
- Actualizado `no-autorizado/page.tsx` — usa `signOut` de NextAuth
- Actualizado `Sidebar.tsx` y `BottomNav.tsx` — usan `UserMenu`
- Actualizado 10+ páginas del dashboard — todas reemplazaron `useAuth`/`getToken` por `getClientToken`/`useSession`
- Actualizado `usuarios/layout.tsx` y `dashboard/page.tsx` — usan `auth()` de NextAuth en vez de `currentUser()` de Clerk

**Prisma:**
- Actualizado `schema.prisma`: eliminado `clerkId`, agregados `emailVerified`, `hashedPassword`, modelos `Account`, `Session`, `VerificationToken`
- Creada migración `20260520000000_migrate_clerk_to_nextauth` y aplicada en producción

**API Express:**
- Actualizado `middleware/auth.ts` — verifica JWT con `jsonwebtoken` + `NEXTAUTH_SECRET`
- Actualizado `routes/auth.ts` — elimina toda referencia a Clerk, registro con bcrypt, CRUD de usuarios
- Simplificado `routes/webhooks.ts`

**Infraestructura:**
- Configuradas variables en Vercel: `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, `DIRECT_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- Configurado `web/vercel.json` con `buildCommand` que incluye `prisma generate`
- Build exitoso en Vercel ✅

**Fix Railway API Crash:**
- Eliminado `CLERK_SECRET_KEY` de `api/src/utils/validateEnv.ts` — reemplazado por `NEXTAUTH_SECRET`
- Agregado `NEXTAUTH_SECRET` en Railway variables
- Railway redesplegado → API **Online** ✅ (`https://api-production-79572.up.railway.app/health`)

**Primer usuario admin:**
- Usuario `pregrupo500@gmail.com` existía desde migración Clerk pero sin contraseña
- Script `api/scripts/check-admin.ts` detectó y actualizó — hash bcrypt aplicado
- Password `Grupo500.` verificado correctamente ✅

**Modal "Agregar usuario" mejorado:**
- Ahora incluye campos: nombre completo, teléfono (opcional), email, contraseña temporal, rol
- Botón deshabilitado hasta que nombre + email + contraseña (≥8 chars) estén completos
- Flujo: admin crea usuarios desde la app, sin signup público

**Google OAuth configurado:**
- `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` agregados en Vercel (producción)
- `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` agregados en Railway
- Botón "Continuar con Google" activo en sign-in ✅

### Estado final sesión 005
- **Vercel (frontend):** ✅ Online con email/password + Google OAuth
- **Railway (API):** ✅ Online — `/health` responde `{ status: "ok" }`
- **Primer admin:** ✅ `pregrupo500@gmail.com` / `Grupo500.`
- **Plataforma lista para uso del equipo**

### Pendiente
- Crear usuarios del equipo desde Usuarios → Agregar usuario
- Zoom API — reporte de asistencia por reunión (fase futura)
- Twilio WhatsApp real (fase futura)
- Face ID / WebAuthn (fase futura)

---

## Sesión 006 — 2026-05-21

**Objetivo:** Integración Typeform, mejoras financieras, marketing en reportes.

### Lo que se hizo

**Typeform — Formulario de inscripción:**
- Nuevo endpoint `POST /api/typeform/crear-formulario` — crea formulario completo en Typeform con todos los campos del negocio
- Campos: datos estudiante, acudiente, información académica, curso (dinámico desde BD), pago, comprobante, marketing, T&C, confirmación
- Eliminado campo "¿Cuántos años tienes?" — edad se calcula automáticamente desde `fechaNacimiento` en el webhook
- Cursos cargados dinámicamente desde la BD (sin precio en la etiqueta para soportar promociones)
- Monto en formato colombiano `600.000` (texto, no número)
- Comprobante temporal como `short_text` (link) — `TODO: cambiar a file_upload` cuando se adquiera plan de pago Typeform
- Webhook `POST /api/typeform/webhook` procesa respuestas automáticamente:
  - Busca/crea colegio
  - Crea estudiante con todos los campos nuevos del schema
  - Crea acudiente
  - Crea `CursoEstudiante` con descuento calculado por valor en pesos
  - Crea `FuenteContacto` para marketing
  - Crea `Pago` con comprobante adjunto
- Webhook configurado en Typeform → `https://api-production-79572.up.railway.app/api/typeform/webhook` ✅
- Botón "Formulario" en módulo Estudiantes → genera link y lo copia al portapapeles

**Schema Prisma — migración `20260521221741_add_typeform_fields`:**
- `Estudiante`: `direccion`, `grado`, `primerIcfes`, `puntajeAnterior`, `carreraInteres`, `universidadInteres`, `interesPremedico`, `fuenteContacto`
- `Acudiente`: `email` ahora opcional, agregados `tipoDocumento`, `numeroDocumento`
- Nuevo modelo `FuenteContacto`: fuente, formId, respondedAt

**Pagos directos — marcar como pagado:**
- Nuevo componente `FilaPagoDirecto` en vista del estudiante
- Botón "Marcar pagado" despliega panel inline con: fecha de pago + subida de comprobante (Cloudinary)
- Mutation `PATCH /pagos/:id` con estado, fechaPago y comprobante

**Reportes — sección Marketing:**
- Nuevo endpoint `GET /reportes/marketing` — agrupa estudiantes por fuente de contacto con cantidad y porcentaje
- Sección "Fuentes de contacto" en `/reportes`:
  - Gráfica de barras por canal (Recharts)
  - Lista detallada con barra de progreso y porcentaje por fuente
  - Etiquetas cortas para el gráfico (IG Link, TikTok, Google, Referido, etc.)

### Decisiones técnicas
- Descuento calculado por valor en pesos (precio curso - monto consignado) → convertido a % para el schema
- `file_upload` de Typeform requiere plan de pago → temporal con `short_text` + link
- Edad calculada server-side desde fechaNacimiento (no se pregunta en el form)
- `show_typeform_branding: false` removido (requiere plan de pago)

### Estado final sesión 006
- **Typeform:** ✅ Formulario crea automáticamente con cursos dinámicos
- **Webhook:** ✅ Estudiante + CursoEstudiante + Pago + FuenteContacto registrados automáticamente
- **Pagos directos:** ✅ Marcar pagado con comprobante desde la app
- **Reportes Marketing:** ✅ Gráfica de fuentes de contacto

---

## Sesión 007 — 2026-05-22

**Objetivo:** Face ID / WebAuthn passkeys + medios de pago en reportes + correcciones UX.

### Lo que se hizo

**Correcciones UX:**
- `lineaAutorizada` (campo 1–6): dropdown admin-only en modal de crear y en perfil estudiante
- Autocomplete en modal de Usuarios: `type="search"` en buscador + `autoComplete="new-password"` en email/password
- Rol "Asesor / Vendedor" → renombrado a "Asesor"
- Contraseña de asesor: fix mutation con try/catch independientes por operación
- "Olvidaste tu contraseña": reemplazado `<a href="mailto:">` por modal con botón WhatsApp
- Asesor puede crear/editar colegios (solo admin puede eliminar)
- Dashboard asesor: corregido bug donde `requireRole('ADMIN')` bloqueaba `/reportes/dashboard`
- Dashboard asesor: datos reales filtrados por `asesorId` (estudiantes, cobranza, cursos, cobrado mes)

**WebAuthn / Face ID:**
- Modelo `Passkey` en Prisma + migración aplicada a Neon
- `api/src/routes/passkeys.ts`: 6 endpoints completos
  - `GET /passkeys` — lista passkeys del usuario
  - `DELETE /passkeys/:id` — elimina passkey
  - `POST /passkeys/register/start` — genera opciones de registro (platform: Face ID/Touch ID)
  - `POST /passkeys/register/finish` — verifica y guarda en DB
  - `POST /passkeys/auth/start` — genera challenge de autenticación
  - `POST /passkeys/auth/finish` — verifica + emite JWT firmado con NEXTAUTH_SECRET
- `web/src/auth.ts`: provider `credentials-passkey` que verifica el JWT via `jose`
- Login page: botón "Face ID / Huella digital" con `@simplewebauthn/browser`
- `UserMenu.tsx`: opción "Face ID / Biometría" → modal para registrar/eliminar passkeys

**Medios de pago:**
- Backend: `GET /reportes/medios-pago` — agrupa pagos y cuotas por método de pago con monto y cantidad
- Frontend `/reportes`: nueva sección "Medios de pago" con gráfica de barras + lista detallada con barra de progreso

### Variables de entorno requeridas (Railway + Vercel)
```
WEBAUTHN_RP_ID=grupo500.com          # dominio de producción (sin https://)
WEBAUTHN_RP_NAME=Grupo 500
WEBAUTHN_ORIGIN=https://grupo500.com # URL exacta de producción
```

### Pendiente
- Botón "Importar" en Estudiantes (esperando plantilla Excel del usuario)
- Dashboard real-time: convertir sección asesor a Client Component con TanStack Query + SSE

### Pendiente — Formulario Typeform: selector de ciudad/municipio filtrable

**Requiere plan de pago Typeform (Business o superior).**

Actualmente la pregunta "¿En qué ciudad y departamento vives?" es texto libre. La mejora sería:
1. Dropdown de **departamento** (32 opciones)
2. Lógica condicional → según departamento seleccionado, mostrar dropdown de **municipios** correspondiente
3. Base de datos de municipios de Colombia (JSON público disponible)

**Bloqueado por:** plan gratuito de Typeform (límite de preguntas y lógica condicional)
**Acción:** Implementar cuando se actualice el plan de Typeform

---

### Propuesta pendiente de análisis — Automatización completa

**Guardada para próxima sesión.** Propuesta de dos flujos de automatización:

**Flujo 1 — Compra por pasarela de pago (web):**
- Estudiante paga en web con Wompi/MercadoPago → webhook de pago crea registro automático → redirige a Typeform con hidden fields (curso, monto, referencia) → estudiante solo llena datos personales → webhook Typeform completa el perfil

**Flujo 2 — Transferencia manual (WhatsApp):**
- Asesor genera link personalizado desde la app con curso preseleccionado (hidden field) → estudiante llena el form → webhook registra todo con pago pendiente de verificar

**Módulos a construir para automatización:**
| Módulo | Prioridad | Descripción |
|--------|-----------|-------------|
| Hidden fields Typeform | Alta | Curso, asesor, fuente pre-llenados vía URL |
| Botón "Generar link asesor" | Alta | Asesor elige curso → genera link personalizado |
| Integración Wompi/MercadoPago | Media | Webhook de pago → registro automático |
| Página de cursos en web | Media | Landing con precios + botón de pago |
| File upload comprobante | Baja | Requiere plan de pago Typeform |

---

## Sesión 008 — 2026-05-22

**Objetivo:** Performance, bugs real-time, importar Excel, auditoría OWASP.

### Lo que se hizo

**Performance:**
- `estudiantes/page.tsx`: eliminado `queryClient.invalidateQueries()` global en mount → reemplazado por invalidaciones específicas por query key
- `QueryProvider.tsx`: eliminado `ReactQueryDevtools` (se cargaba en producción)
- Queries secundarias (colegios, asesores-select, cursos-select) con `staleTime: 5min`

**Fix ERR_HTTP_HEADERS_SENT:**
- `api/src/index.ts`: agregado guard `if (!res.headersSent)` en callback de `res.setTimeout()`

**Bug "Próximos cobros" vacío — 5 causas resueltas:**
1. Query key mismatch: `useSSE.ts` usaba `'proximos-cobros'` vs `'cobros-proximos'` en el componente — corregido
2. Admin sin SSE: creado `SSEProvider.tsx` ('use client') y envuelto `{children}` en el layout del dashboard
3. Sin broadcast en pagos: `pagos.controller.ts` ahora llama `broadcast('pago-registrado', ...)` en `registrar()` y `actualizar()`
4. Sin broadcast en cuotas: `cuotas.controller.ts` ahora llama `broadcast()` cuando `data.pagado !== undefined`
5. API solo traía cuotas (financiados): `cobros.controller.ts::proximos()` ahora combina `Cuota` + `Pago PENDIENTE` en el rango

**Importación Excel de estudiantes:**
- `middleware/upload.ts`: nuevo `uploadExcel` con memoryStorage, acepta .xlsx/.xls, límite 10MB
- `estudiantes.controller.ts`: función `importar()` — parsea Excel, agrupa por teléfono, crea estudiantes + pagos en lote
- `routes/estudiantes.ts`: ruta `POST /import` (solo ADMIN)
- `estudiantes/page.tsx`: botón "Importar" + modal con resultado (creados / actualizados / errores)

**Seguridad OWASP — fixes aplicados:**
- **A01 Broken Access Control:**
  - `estudiantes.controller.ts::listar()`: VENDEDOR scoped a sus propios estudiantes
  - `estudiantes.controller.ts::actualizar()`: solo ADMIN puede cambiar `asesorId`
  - `negociaciones.controller.ts::listar()`: VENDEDOR scoped a sus propias negociaciones
  - `colegios.ts`: `POST /` y `PATCH /:id` ahora requieren `requireRole('ADMIN')`
- **A07 Auth Failures:**
  - `passkeys.ts`: JWT expiry `'30d'` → `'8h'`
  - `index.ts`: auth rate limit ahora cuenta intentos exitosos también (`skipSuccessfulRequests: false`)
- **A09 Logging:**
  - `auth.ts`: `AUTH_FAILURE` ahora incluye `email` y `userId` (decodificado sin verificar para trazabilidad)
- **A10 SSRF:**
  - `simulacros.controller.ts`: validación de URL contra allowlist de dominios Cloudinary antes de fetch; timeout 15s; límite 50MB

### Pendientes OWASP (registrados para próxima sesión)
| Prioridad | Tarea |
|-----------|-------|
| MEDIA | Certificados — agregar filtro `asesorId` para VENDEDOR en `certificados.controller.ts` |
| MEDIA | next-auth beta → stable cuando salga release oficial |
| BAJA | `$queryRaw` en `asesores.controller.ts` — reemplazar por Prisma nativo |
| BAJA | Agregar `correlationId`/`requestId` a todos los logs de Railway |

---

## Sesión 004 — 2026-05-19

**Objetivo:** Unificar módulo Estudiantes + Cobros, mejoras de UX profundas, historial de modificaciones.

### Lo que se hizo

**Backend:**
- `schema.prisma`: migración `20260519190527` — campos `medioPago` y `notas` en `Cuota`; nuevo modelo `HistorialEstudiante`
- `auth.ts`: expone `req.userName` desde asesor o usuario
- `cuotas.controller.ts`: reescritura completa — cuotas editables (monto + fechaVencimiento), medioPago, historial, auto-cierre financiamiento
- `estudiantes.controller.ts`: datos financieros en listar, auto-corrige ACTIVO→COMPLETADO, nueva función historial()
- Ruta `GET /estudiantes/:id/historial`

**Frontend:**
- Tarjetas con barra de progreso, saldo, estado (Al día / Pendiente / En mora), filtros, sync en tiempo real, hover/tap feedback
- Detalle estudiante [id]: 3 tabs — Perfil | Financiero | Historial
  - FilaCuota con edición inline (pencil en hover)
  - FormAbono colapsable: por cuota, monto, fecha, medioPago (Bancolombia/Bre-B/Otro), comprobante
  - Historial como timeline con badges y realizadoPor
- Certificados: buscador debounced reemplaza select dropdown
- Cobros eliminado de navegación (integrado en Estudiantes)

### Pendiente
- Twilio WhatsApp real
- Exportar reportes CSV/PDF

---

## Sesión 009 — 2026-05-30

**Objetivo:** Construir plataforma pública: landing page, hub de inscripciones y formulario propio Cal A.

### Lo que se hizo

**Plataforma pública (3 capas):**
- `grupo-500.vercel.app/` → Landing page pública con hero, estadísticas, beneficios del curso, calendarios activos dinámicos, testimonios y CTA final
- `grupo-500.vercel.app/inscripcion` → Hub de inscripciones: muestra calendarios con `visibleEnLanding=true`, precio general, promos, cupos, inscritos
- `grupo-500.vercel.app/inscripcion/[calId]` → Formulario propio multi-paso Cal A

**Formulario propio (6 pasos optimizados):**
1. Datos del estudiante (nombre, email, celular, tipo doc, número doc)
2. Ubicación: selector departamento → municipio filtrado dinámico (33 departamentos, ~1100 municipios de Colombia), fecha nacimiento, dirección, colegio, grado
3. Acudiente (nombre, parentesco, celular, doc)
4. Info académica adaptativa (primer ICFES, puntaje, carrera, interés salud, premédico, universidad)
5. Pago: curso precargado, cuenta, monto (opciones con precios general + promo + 50%), upload comprobante + documento identidad a Cloudinary
6. Marketing + T&C con checkbox de aceptación

**Backend:**
- `POST /api/inscripcion/publica` — crea estudiante + acudiente + pago + curso + fuente marketing en BD y sincroniza a HubSpot CRM en paralelo
- `GET /api/inscripcion/calendarios-activos` — cursos visibles en landing con precios desde ConfigApp
- `GET /api/inscripcion/cursos/:calId` — datos del curso con precios para el formulario
- `POST /api/inscripcion/upload-comprobante` + `upload-documento` — uploads públicos a Cloudinary
- OCR del comprobante con Cloudinary AI (best-effort, guarda nota con resultado en `Pago.notas`)
- `PATCH /api/config/precios` — admin configura precio general, promos y cupos por curso

**Módulo admin `/dashboard/calendarios`:**
- Toggle `visibleEnLanding` por curso (activa/desactiva la card en la plataforma pública)
- Modal de precios: precio general, precios promo (coma-separados), cupos disponibles
- Descuentos calculados automáticamente al inscribirse: `((precioGeneral - montoConsignado) / precioGeneral) * 100`

**Schema Prisma — migración `20260530135201_add_landing_fields`:**
- `Estudiante`: +`documentoUrl`, +`direccion`
- `Curso`: +`visibleEnLanding Boolean @default(false)`, +`cuposDisponibles Int?`

**Otros:**
- `auth.config.ts`: rutas `/inscripcion*` y `/` marcadas como públicas (sin login)
- Sidebar + BottomNav: ítem "Calendarios" agregado (solo ADMIN)
- `tsconfig.json`: `declaration: false` (elimina TS2742 pre-existente en toda la API)
- `web/src/data/municipios.ts`: JSON de 33 departamentos con todos sus municipios

### Pendiente
- Formularios Cal B y Cal C (misma estructura, diferente calendario)
- Twilio WhatsApp real
- Exportar reportes CSV/PDF

---

## Sesión 010 — 2026-05-30

**Objetivo:** Completar plataforma pública — formulario dinámico Cal A funcional, módulo Formularios en la app, correcciones de flujo y UX.

### Lo que se hizo

**Módulo Formularios (`/dashboard/formularios`):**
- Reemplazó el módulo Calendarios por Formularios (icono `ClipboardList`)
- Constructor visual de formularios con paleta de 10 tipos de campo y canvas drag-free
- Sección "Términos y Condiciones" con upload de PDF a Cloudinary y lightbox con proxy propio
- FormCard: badges ACTIVO/LANDING con dot pulsante, toggle activo/landing, copiar link, editar, eliminar
- Formulario Cal A sembrado en BD: 28 campos en 6 secciones, activo, visibleEnLanding=true

**Formulario dinámico público (`/inscripcion/f/[id]`):**
- Renderer genérico que carga cualquier formulario activo desde la BD
- Municipio filtrado dinámicamente según departamento seleccionado (DEPARTAMENTOS_MUNICIPIOS)
- Campo `header_image` especial: muestra banner al ancho completo del card
- Header del Cal A: imagen `Header - Formulario Cal A.webp` subida a Cloudinary
- T&C con lightbox propio (proxy `/api/pdf-proxy`) — botón "Acepto" marca checkbox desde el modal
- Envío real: `POST /api/inscripcion/publica` → crea estudiante en BD, sube archivos a Cloudinary

**Backend:**
- `GET /api/inscripcion/formularios-activos` — formularios con `activo=true` y `visibleEnLanding=true`
- `GET /api/inscripcion/formularios/:id` — leer formulario activo sin auth (público)
- `GET /api/config/terminos` — URL del PDF de T&C
- `POST /api/config/terminos` — upload PDF T&C a Cloudinary (fix: `public_id` como función async)
- Rutas CRUD de formularios (`/api/formularios`) — autenticadas, ADMIN para escritura

**Landing page:**
- Ahora muestra formularios activos (`visibleEnLanding=true`) en lugar de cursos
- Cada card enlaza a `/inscripcion/f/<id>`
- Botones Hero y CTA final apuntan al anchor `#inscribirse`

**Proxy PDF (`/api/pdf-proxy`):**
- Route handler en Next.js que descarga PDF de Cloudinary y lo sirve desde el mismo origen
- Evita bloqueo `X-Frame-Options: DENY` de Cloudinary en iframes
- CSP actualizado: `frame-src 'self'` agregado para permitir iframe mismo origen

**Correcciones de flujo:**
- `syncEstudianteHubspot()` removido de `POST /api/inscripcion/publica`
  → Los leads llegan a HubSpot vía redes sociales (Meta/Instagram), no por el formulario
  → El formulario Cal A es post-pago: solo crea el estudiante en la app
- Fecha de nacimiento movida al Paso 1 (Datos personales) del formulario multi-paso
- Campo "Dirección de residencia" eliminado de ambos formularios (dinámico y hardcodeado)
- Campo "¿Cuánto dinero consignaste?" eliminado — monto extraído por OCR del comprobante
- `municipio` actualizado en BD de `tipo: 'texto'` a `tipo: 'select'`

**Errores registrados (nuevos):**
- `multer-storage-cloudinary`: `public_id` debe ser función async, no string literal → error "public_id is not a function"
- Cloudinary raw + Google Docs viewer bloquean iframe → solución: proxy Next.js desde mismo origen
- JSX con dos elementos en paralelo sin fragmento `<>` → error de compilación en Vercel

### Flujo de negocio confirmado
1. Lead llega a HubSpot vía redes sociales (Meta/Instagram)
2. Asesor contacta, convence y cobra
3. Asesor envía link del formulario Cal A al estudiante
4. Estudiante llena formulario → se crea en la app (BD) + notificación SSE en tiempo real
5. Admin ve el nuevo estudiante y confirma el pago

### Pendiente
- Formularios Cal B y Cal C
- Reestructurar landing: formulario corto de captación (leads → HubSpot) separado del formulario completo de matriculación
- Twilio WhatsApp real
- Exportar reportes CSV/PDF
- PDF T&C: verificar que el lightbox muestre correctamente en producción

---

## Sesión 011 — 2026-05-31

**Objetivo:** Anexos completos al formulario Cal A (selector de curso, asesor por URL, métodos de pago, verificación de matrícula), eliminación del constructor visual, mejoras al módulo Estudiantes.

### Lo que se hizo

**Schema Prisma — migración `add_form_annexes`:**
- `Curso`: +`fechaIcfes DateTime?`, +`simulacros Int?`
- `Estudiante`: +`verificado Boolean @default(false)`, +`verificadoPor String?`, +`verificadoAt DateTime?`
- `Pago`: +`referenciaPago String?`, +`comprobanteAt DateTime?` (timestamp de recepción en plataforma)

**Backend (`api/src/routes/inscripcion.ts`):**
- `POST /api/inscripcion/publica` reescrito completo:
  - Valida asesorId si viene en payload (bloquea si inválido)
  - Valida cursoId (bloquea si no existe o no está activo)
  - Acepta `metodoPago` enum (Bancolombia, Interbancario, Nequi, Bre-B, Addi, Sistecredito, Otro)
  - `referenciaPago` obligatorio
  - `comprobanteUrl` obligatorio (validación `.url()` en zod)
  - Idempotencia por email: si ya existe NO crea pago adicional, retorna `yaExistia: true`
  - Crea Pago con método, referencia y `comprobanteAt = ahora` (timestamp interno)
  - Broadcast SSE incluye `asesorId` y nombre del curso
- `GET /api/inscripcion/asesor/:id` — endpoint público para validar asesor y obtener nombre
- `GET /api/inscripcion/cursos-activos` — endpoint público para selector dinámico de cursos
- Eliminado el campo `direccion` del schema (no se pide más)
- Eliminado mapeo `cuentaPago`, `montoDeclarado` del schema

**Endpoint verificación (`api/src/routes/estudiantes.ts`):**
- `PATCH /api/estudiantes/:id/verificar` — confirma matrícula
- Guarda `verificadoPor` (nombre del admin) y `verificadoAt` (timestamp)
- Audit trail incluido

**Formulario Cal A (BD - 31 campos finales):**
- Eliminados: `direccion`, `cuenta_pago`, `valor_curso`, `monto_consig` + 3 campos residuales del builder
- Agregados al PRINCIPIO del formulario (después del header):
  - Sección "Curso a adquirir"
  - `curso_seleccionado` (select) con tarjeta info dinámica
- Agregados en sección de pago:
  - `metodo_pago` (radio con 7 opciones)
  - `referencia_pago` (texto)
- `comprobante` ahora marcado como **obligatorio**
- Orden final: Header → Curso → Datos estudiante → Ubicación → Acudiente → Académico → Pago → Marketing

**Frontend renderer (`/inscripcion/f/[id]`):**
- Detección automática de asesor por URL `?asesor=ID`
- Pantalla de bloqueo si asesor inválido (no se puede inscribir sin link válido)
- Muestra nombre del asesor en el header del formulario
- Selector de curso con tarjeta info dinámica:
  - Fecha de inicio
  - Fecha del ICFES
  - Horas de duración
  - Cantidad de simulacros
- Hint dinámico debajo de `referencia_pago` según método seleccionado
- `mapTipoDoc()` mapea opciones legibles → enum del backend ('TI', 'CC', 'CE', 'PA', 'Otro')
- Payload actualizado: `cursoId`, `metodoPago`, `referenciaPago`, `asesorId`
- Validación NO incluye campos ocultos por lógica condicional
- Error específico cuando email ya existe

**App — perfil estudiante (`/dashboard/estudiantes/[id]`):**
- Nuevo componente `ConfirmarMatriculaBtn`:
  - Estado idle: botón outlined gris
  - Estado confirmando: Sí/No
  - Estado verificado: badge verde + tooltip con quién/cuándo + opción desmarcar
- Visible en header del perfil junto al botón eliminar

**App — módulo Formularios (`/dashboard/formularios`):**
- **ELIMINADO COMPLETAMENTE el constructor visual** (FormBuilder + CampoEditor)
  - Ruta dedicada `/builder/[id]` eliminada en sesión 010
  - Componentes inline FormBuilder y CampoEditor también eliminados ahora
  - Empty state actualizado: "se gestionan directamente desde la BD"
- Botones "Nuevo formulario" y "Editar" eliminados
- Mantiene: lista, toggle activo/landing, copiar link, abrir, eliminar
- Nuevo componente `EnlaceAsesorBtn` por cada FormCard:
  - Botón "Generar enlace por asesor"
  - Lista todos los asesores con link copiable `?asesor=ID`
  - Animación slide-up al abrir
- Nuevo botón **"Editar nombre"** (icono lápiz aparece al hover):
  - Modal centrado con input enfocado
  - Enter para guardar, Esc para cancelar
  - Validación min 2 chars
  - Toast verde de confirmación
  - PATCH invalida queries — se actualiza en panel, formulario público y landing

**App — módulo Estudiantes — cambio crítico de UX:**
- **TODOS los usuarios** ahora ven **TODOS los estudiantes** por defecto
- Antes: VENDEDOR solo veía sus propios estudiantes (filtro forzado)
- Ahora: vista global compartida, asesor asignado queda como info interna
- Nuevo toggle "Solo asignados a mí" en barra de filtros con dot pulsante azul
- Backend: parámetro de query `?soloMios=true`
- Razón: vendedores nuevos no veían nada al login porque ningún estudiante tenía su `asesorId`

### Bugs corregidos durante la sesión

1. **🔴 `tipoDocumento` enum mismatch:** el formulario enviaba "Tarjeta de Identidad" pero el backend espera `'TI'` → 400 forever. Agregado `mapTipoDoc()`.
2. **🔴 Validación con lógica condicional:** campos ocultos requeridos hacían imposible enviar el formulario.
3. **🟠 Comprobante:** si fallaba el upload silenciosamente, enviaba File casteado a string.
4. **🟠 Email duplicado:** mostraba pantalla de éxito falsa en lugar del mensaje real.
5. **🟡 Error de red en GET asesor:** mostraba "formulario no disponible" en vez de "asesor inválido".
6. **🟡 Builder JSX residual:** `router.push('/formularios/builder/...')` apuntaba a ruta eliminada (TypeScript fail).
7. **🟡 Lightbox PDF Cloudinary:** Cloudinary raw bloquea iframe por X-Frame-Options. Solución: proxy `/api/pdf-proxy` que descarga el PDF y lo sirve desde mismo origen.

### Errores nuevos registrados en `~/.claude/CLAUDE.md`
- `tipoDocumento` debe mapearse de texto legible a enum del backend
- Cloudinary raw + Google Docs viewer ambos bloquean iframe → proxy propio
- JSX con dos elementos en paralelo sin fragmento `<>` rompe el build

### Estado final de la sesión 011
- **Backend:** ✅ Migración aplicada en producción (Neon)
- **Frontend:** ✅ TypeScript sin errores
- **Constructor visual:** ❌ Completamente eliminado (los formularios se editan vía scripts en BD)
- **Formulario Cal A:** ✅ 31 campos, con selector de curso, métodos de pago, asesor por URL
- **Verificación de matrícula:** ✅ Botón funcional en perfil de estudiante con auditoría
- **Vista de estudiantes:** ✅ Compartida + filtro opcional "soloMios"

### Flujo final del formulario (post-sesión 011)
```
Asesor genera su link personalizado (1 sola vez)
        ↓
Comparte: grupo-500.vercel.app/inscripcion/f/<formId>?asesor=<asesorId>
        ↓
Estudiante abre → ve nombre del asesor en header
        ↓
Selecciona curso → ve tarjeta info dinámica
        ↓
Llena datos + sube comprobante obligatorio
        ↓
POST /inscripcion/publica → valida + crea estudiante + Pago con método/ref
        ↓
Notificación SSE (broadcast con asesorId + curso)
        ↓
Admin/Asesor revisa → presiona "Confirmar matrícula" → ✓ Verificado
```

### Pendientes para próxima sesión
- **Imágenes instructivas por método de pago** (cuando el usuario las comparta) — agregar imagen visible debajo del select de método
- **Separar "otros ingresos" de "anticipos"** en el módulo financiero (estaban mezclados)
- **Notificación SSE específica al asesor** (actualmente broadcast global, todos reciben)
- **Configurar `fechaIcfes` y `simulacros`** para los cursos existentes desde el módulo de Cursos (UI de edición)
- **Formularios Cal B y Cal C** (mismo flujo, calendario diferente)
- **Twilio WhatsApp real** (reemplazar stub)
- **Exportar reportes CSV/PDF**

### Notas técnicas importantes
- Constructor de formularios fue eliminado a petición del usuario porque los formularios se gestionan vía scripts directos en BD
- La vista compartida de estudiantes responde a: "el asesor asignado es solo informativo, no debe limitar visibilidad"
- Los enlaces por asesor cuentan como **un mismo formulario** (todas las respuestas suman al mismo `formId`), pero cada estudiante queda registrado con su `asesorId` específico para tracking individual

---

## Sesión 012 — 2026-06-02

**Objetivo:** Mejoras de UX en formulario Cal A, perfil estudiante, dashboard asesor y visor de PDF T&C en móvil.

### Lo que se hizo

**Formulario Cal A (`/inscripcion/f/[id]`):**
- **CustomSelect / CustomDate con portal:** dropdowns usaban `position: fixed` + `getBoundingClientRect` pero seguían siendo atrapados por animaciones CSS que crean stacking contexts. Solución final: `createPortal(jsx, document.body)` — los dropdowns renderizan fuera del árbol DOM.
- **Scroll interno de dropdowns:** `window.addEventListener('scroll', ..., true)` capturaba todos los eventos de scroll y cerraba los dropdowns. Fix: solo cerrar si el scroll ocurre en `document`, `documentElement` o `body`.
- **CustomDate — selector de mes/año:** agregado estado `vista` ('dias' | 'meses' | 'años') para navegar en el calendario sin solo poder elegir el día.
- **Opción "Otro" en selects:** cuando el valor es 'Otro', muestra input de texto libre. Se guarda como `Otro: [texto]` en el payload.
- **PhoneInput con bandera e indicativo:** componente con 120+ países, imagen de bandera via `purecatamphetamine.github.io` (flag SVGs), default Colombia (+57), máximo 10 dígitos para +57. Layout `flex flex-row items-center`.
- **CSP para imágenes de banderas:** `next.config.ts` — agregado `https://purecatamphetamine.github.io` y `https://flagcdn.com` a `img-src`.
- **"Leer documento" en una sola línea:** `whitespace-nowrap` en el botón. Movido debajo del título T&C con layout `flex-col gap-1.5`.
- **Label T&C + botón en misma fila (sm+):** `flex flex-col sm:flex-row sm:items-center sm:justify-between`.
- **Parentesco:** reordenado — Papá primero, luego Mamá.
- **Visor PDF T&C en móvil:** instalado `react-pdf` (v10). Worker cargado desde `/pdf.worker.min.mjs` (archivo local en `public/`) para evitar bloqueo CSP. Proxy `/api/pdf-proxy` sirve el PDF con header `Access-Control-Allow-Origin: *` para que PDF.js pueda leer el buffer. Funciona en iOS Safari, Android Chrome y desktop.

**Perfil estudiante (`/dashboard/estudiantes/[id]`):**
- **Campo `nombreGrupo`:** aparece condicionalmente cuando `agregado === 'si'`. Migración `add_nombre_grupo` aplicada en Neon.
- **Tab Observaciones:** CRUD completo — textarea + lista, eliminar al hover (solo admin), ícono `MessageSquarePlus`. Modelo `Observacion` en Prisma + migración `add_observaciones` + 3 endpoints en API.
- **Pagos PAGADOS:** en edición muestra "Fecha de pago" (no "Fecha de vencimiento"). Los pagos pagados nunca muestran campo de vencimiento.
- **Precio final editable:** input toma el precio final, calcula `descuento = precioBase - precioFinal` en tiempo real.
- **Tooltip "Verificado" con portal:** tooltip y botón "Desmarcar" ya no quedan cortados por `overflow: hidden` del contenedor — renderizado con `createPortal`.

**Dashboard asesor:**
- **ProximosCobros clickeable:** cada fila navega a `/estudiantes/:id` al hacer clic.
- **Tarjeta "Cursos disponibles" eliminada:** removida del panel del asesor.
- **Saludo con nombre real:** `session.user.name` (primer nombre) en vez del email. Fix en `auth.config.ts` y `auth.ts` para propagar `token.name` desde la DB/Google profile.

**Módulo Cursos:**
- **Badge "Individual":** cursos individuales muestran badge azul (igual que el amber de "Combo").
- **Segmented control:** eliminado sliding indicator (rompía con botones de ancho desigual). Active state aplicado directamente con clases CSS.
- **Script `fix-tipo-curso.ts`:** marca cursos con "combo"/"+" en el nombre como `TipoCurso.COMBO` en la BD.

**Módulo Formularios:**
- **Tarjeta T&C responsive:** `flex-col` en móvil (ícono+texto arriba, botón "Subir PDF" abajo ancho completo), `flex-row` en `sm+`.

**Otros:**
- **`@import` Google Fonts:** movido al inicio de `globals.css` (antes de `@tailwind`) para eliminar warning del navegador.

### Errores registrados
| # | Contexto | Error | Solución |
|---|----------|-------|----------|
| 013 | react-pdf + CSP | Worker cargado desde `unpkg.com` bloqueado por `script-src` | Copiar `pdf.worker.min.mjs` a `public/` y apuntar workerSrc a `/pdf.worker.min.mjs` |
| 014 | react-pdf + Cloudinary | PDF.js no puede fetch directo a Cloudinary (CORS en raw uploads) | Usar `/api/pdf-proxy` que sirve el PDF con `Access-Control-Allow-Origin: *` |
| 015 | CSS globals.css | `@import` después de `@tailwind` genera warning del navegador | `@import` siempre debe ir ANTES de cualquier otra regla en el CSS |

### Pendientes
- Imágenes instructivas por método de pago
- Separar "otros ingresos" de "anticipos" en módulo financiero
- Notificación SSE específica al asesor
- Configurar `fechaIcfes` y `simulacros` desde UI de cursos
- Formularios Cal B y Cal C
- Twilio WhatsApp real
- Exportar reportes CSV/PDF
