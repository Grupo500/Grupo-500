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

---

> **Nota sobre las sesiones 013 en adelante:** este bloque fue reconstruido el 2026-07-31 a partir del historial de `git log` (no hay notas de sesión originales para este período de ~2 meses). El detalle es más grueso que el de las sesiones anteriores — resume commits agrupados por fecha/tema, no decisiones discutidas en vivo. Ver también `docs/ARQUITECTURA.md`, actualizado en la misma auditoría.

## Sesión 013 — 2026-06-12 (parte 1)

**Objetivo:** Endurecer seguridad y mejorar dashboard/reportes.

### Lo que se hizo
- **Seguridad:** Sentry (`@sentry/node` + `@sentry/nextjs`), `reqId` de correlación por request, health check profundo (`SELECT 1` antes de responder 200), CSP con `frame-ancestors`, `eslint-security`, certificados restringidos a VENDEDOR.
- **Dashboard:** tabs de período reemplazadas por `MonthPicker` (rango de fechas), gráfica anual + gráfica de estudiantes por mes, comparación contra el mismo corte de días del período anterior.
- **Reportes:** mapa de Colombia con geometría real (GeoJSON vía `react-simple-maps`), inset de San Andrés y Providencia, Top 10 ciudades como ranking con barras de progreso (reemplaza el donut).

---

## Sesión 014 — 2026-06-12 (parte 2)

**Objetivo:** Integrar Hotmart como fuente real de ventas, reemplazando HubSpot/Typeform en el flujo de inscripción.

### Lo que se hizo
- Sincronización de productos Hotmart + webhook de compras, con creación automática de curso si no existe.
- Asesor identificado automáticamente por código de rastreo Hotmart (`src`/`sck`) en el webhook.
- **Eliminadas:** integración HubSpot (como fuente de inscripción) y Typeform — ambas reemplazadas por Hotmart. (HubSpot vuelve más adelante, sesión 023, pero solo como fuente de leads para tasa de cierre, no de inscripción.)
- Eventos SSE emitidos en el webhook de Hotmart para actualización en tiempo real del dashboard.
- `precioAcordado` en `CursoEstudiante` — saldo real para compras Hotmart con descuento.
- Fix: rate limit incorrecto en `/api/auth` que bloqueaba la gestión de usuarios.

### Pendiente
- Precios de matrícula real vs. precio de lista, seguir afinando

---

## Sesión 015 — 2026-06-14

**Objetivo:** Simplificar el acceso público y corregir inconsistencias de auth/timezone.

### Lo que se hizo
- **Landing pública eliminada** — la raíz (`/`) ahora redirige directo a login/dashboard.
- Login insensible a mayúsculas, normalización de email a minúsculas en todo el sistema.
- Zona horaria Colombia aplicada consistentemente en el backend.
- Reconciliación automática de asesores como job de fondo (red de seguridad si el webhook de Hotmart no capta el afiliado).
- Reportes: serie financiera por día correcta en rangos mensuales, scroll horizontal con eje Y fijo en gráficas diarias.

---

## Sesión 016 — 2026-06-15

**Objetivo:** Simplificación grande del dominio — eliminar módulos que ya no reflejan cómo se cobra (Hotmart lo hace), y rediseñar el dashboard.

### Lo que se hizo
- **Eliminados por completo:** `Financiamiento`/`Cuota`, calendario de `Cobros`, recordatorios de WhatsApp, sección Marketing y Demografía de reportes. El negocio pasó a que Hotmart gestione cuotas/cobros; la app solo refleja el estado vía `Pago` (con `enPartes`, `cuotaNumero`, `cuotasTotal`).
- Desglose de comisiones en COP calculado server-side (`comisionHotmart`, `comisionAsesor`, `montoNeto`, `trm`).
- **Rediseño del dashboard** a layout 30/70 (resumen mensual sin filtros), alineado a un sistema de diseño nuevo documentado en `DESIGN.md` (raíz del repo).
- Dona de cursos top 5 + rebanada "Otros", Top 5 asesores en tarjetas individuales con foto, KPIs de comisión con color.
- **Reportes:** reestructuración completa — donut de cursos, medios de pago como barras verticales, ranking de asesores paginado con tasa de cierre y comisión, gráfica de ingresos con granularidad adaptativa según el rango del datepicker.

### Nota importante
Este es el punto donde `docs/API.md` empezó a quedar desactualizado (documentaba `/financiamientos`, `/cuotas`, `/cobros`, `/whatsapp`, que dejaron de existir aquí).

---

## Sesión 017 — 2026-06-16

**Objetivo:** Rediseño del sidebar y del dashboard de asesor; consolidar Hotmart.

### Lo que se hizo
- **Sidebar:** rediseño oscuro con módulo activo flotante, curva SVG deformable animada, toggle expandir/contraer integrado (reemplaza el botón flotante).
- **Dashboard asesor:** rediseño con ventas, comisión, posición y ranking; botón de actualizar visible en todos los dispositivos.
- Hotmart: mapeo de `checkout_phone` al teléfono del estudiante; se intentó un backfill de teléfonos desde historial y se revirtió (la API de Hotmart no expone teléfono de ventas pasadas).
- **Estudiantes:** exportar base a Excel (reemplaza el botón "Importar"); eliminado el botón "Mi enlace".
- Fix de tiempo real: ventas y comisiones se actualizaban con delay — corregido.
- Vercel Analytics y Speed Insights agregados.

---

## Sesión 018 — 2026-06-18/19

**Objetivo:** Notificaciones push cuando cambia el ranking de asesores.

### Lo que se hizo
- Notificaciones push (Web Push, modelo `PushSubscription`) cuando un asesor es rebasado en el ranking, con ascensos y cambios de podio para todos los asesores.
- Botón "Activar notificaciones" compatible con iOS.
- Varios reverts/reintentos el mismo día por un incidente de auth en producción (errores de BD se disfrazaban como 401) — diagnosticado y corregido (`fix(auth): no disfrazar errores de BD como 401`).

---

## Sesión 019 — 2026-06-22/24

**Objetivo:** Mejoras de búsqueda/sincronización en Estudiantes y primera versión de tasa de cierre.

### Lo que se hizo
- Buscar estudiantes por correo/teléfono, sincronizar correo desde Hotmart.
- Botones de sincronización manual con Hotmart (individual y general) con mensaje de resultado.
- Módulo Formularios habilitado para asesores (solo lectura + su propio enlace).
- Ranking de asesores: **tasa de cierre**, score 0-100, primera integración con Trengo (leads por WhatsApp).
- Perf: eliminada una conexión SSE duplicada en el dashboard del asesor.

---

## Sesión 020 — 2026-06-25/26

**Objetivo:** Fixes de Hotmart/certificados y arranque del módulo Simulacros Saber 11.

### Lo que se hizo
- Fix: pagos en partes (Smart Installment de Hotmart) ya no se marcaban como completos antes de tiempo.
- Certificados: razón social "GRUPO 500 EDUCACIÓN S.A.S.", firma única del representante legal, nombre de curso y horas correctas.
- **Arranca el módulo de Simulacros Saber 11** (motor de examen online): fusión de la BD de la app Supabase separada (`simulacros-grupo500`) en este monorepo, migración de 22 imágenes de preguntas de Supabase Storage a Cloudinary, muro de acceso (estudiantes fuera del backoffice de ventas), primer panel de admin (estadísticas + gestión de imágenes).

---

## Sesión 021 — 2026-06-27/30

**Objetivo:** Construir el motor de examen completo.

### Lo que se hizo
- Motor de examen: réplica exacta del `ExamenCliente` de la app original.
- Login único para todos los estudiantes en `/sign-in`.
- Edición de preguntas desde el panel de admin, con preview idéntico al examen real, soporte de opciones A-H (preguntas de emparejamiento), botones de sesión S1/S2.
- Examen responsivo para celular.
- **Rediseño del login:** gradiente azul, animaciones, Poppins como fuente global (arrastrado luego a Brito también).
- Hoja de respuestas con porcentaje prominente, chips de área con colores únicos.

---

## Sesión 022 — 2026-07-01/02

**Objetivo:** Pulir la experiencia del examen y evitar trampa.

### Lo que se hizo
- Fix de imágenes en preguntas sin opciones de texto, enunciado sobre la imagen con labels de contexto estilo "cuadernillo" ICFES real.
- Rediseño de animaciones del examen (filosofía Emil Kowalski).
- Cronómetro pausable de 4:30h por sesión + retroalimentación por opción incorrecta.
- Formato de texto tipo cuadernillo en móvil, guardado robusto de respuestas.
- Anti-cheat: bloqueo de clic derecho y atajos de DevTools durante el examen.
- Se inició un glosario compartido de términos de git/programación/IA en `docs/`.

---

## Sesión 023 — 2026-07-03/04

**Objetivo:** Fixes de datos, HubSpot como fuente de leads, y primer elemento 3D en la landing pública.

### Lo que se hizo
- Fixes: exportar Excel bajaba vacío (blob revocado antes de tiempo), nombres de cursos de Hotmart, comparación de variación de asesores contra el mismo corte de días del mes anterior.
- **HubSpot reintegrado**, pero solo como fuente de leads para tasa de cierre — se descubrió que los leads reales están en **Tickets**, no en Contactos (26 contactos históricos vs. miles de tickets).
- Reportes renombrado a **"Analíticas"** en la UI, reorganizado, botones de sync manual removidos.
- **Hero 3D animado con GSAP + Three.js** (`@react-three/fiber`) en `/inscripcion` — causó un conflicto de tipos (`icon: React.ElementType`) que rompió el build de Vercel; resuelto usando `LucideIcon` en vez del tipo genérico (ver memoria del conflicto).
- Fix: bucle infinito en el hook `beforeExit` de Prisma.

---

## Sesión 024 — 2026-07-06

**Objetivo:** Widget de ventas semanales para asesores.

### Lo que se hizo
- Widget "Ventas de la semana" en el dashboard de asesores, con días seleccionables y el mejor día resaltado; cambiado de gráfico de barras a puntos.

---

## Sesión 025 — 2026-07-11

**Objetivo:** Exponer una API pública de solo lectura.

### Lo que se hizo
- API pública de solo lectura en `/api/public/v1`, autenticada con `ApiKey` (hash + scopes + revocación) — ver `docs/API_PUBLICA.md`.
- Script de importación de ventas faltantes de Hotmart.
- Fix del cálculo de porcentaje de comisión en Analíticas.

---

## Sesión 026 — 2026-07-14

**Objetivo:** Reorganizar certificados y crear un módulo de Ajustes unificado.

### Lo que se hizo
- Certificados movidos a un tab dentro del perfil del estudiante (antes módulo aparte); firma del certificado agrandada; se pide número de documento antes de generar.
- **Nuevo módulo Ajustes**, unificando: mi perfil (nombre/teléfono/contraseña/correo de solo lectura/foto), firma, y gestión de API Keys — antes dispersos. Movido al footer del sidebar.
- Rediseño de Ajustes estilo Vercel: sub-navegación en el sidebar, contenido a ancho completo, insignias por sección, animación de transición del sidebar al entrar/salir.

---

## Sesión 027 — 2026-07-21/22

**Objetivo:** Publicar la app en tiendas móviles y cumplir requisitos legales de privacidad.

### Lo que se hizo
- **Nuevo workspace `mobile/`** con Capacitor, para publicar en Google Play y App Store — ver `docs/APP_STORES.md`.
- Fix: `@capacitor/assets` quitado como dependencia permanente (rompía el build de Vercel al quedar en el lockfile compartido).
- Página pública de Política de Privacidad en `grupo500educacion.co/privacidad`.

---

## Sesión 028 — 2026-07-23/26

**Objetivo:** Construir el juego Brito completo — capa de gamificación sobre el banco de preguntas del motor de exámenes.

### Lo que se hizo
- Registro, mapa de lecciones, lecciones jugables, ranking — juego completo de punta a punta.
- Panel `/brito-admin`: tarjetas por materia, constructor de lecciones, formulario de preguntas nuevas (con imagen), selector de sesión, eliminar lecciones.
- Mapa: agrupado por sección global, sendero estilo Duolingo, sidebar (Aprender/Ligas/Recompensas/Perfil), modal de perfil (vía portal a `document.body` para evitar recortes), tema claro tipo "mapa del tesoro".
- **Sistema de ligas semanales** con ascenso y descenso (`BritoGrupoLiga`/`BritoMiembroLiga`).
- Iconografía: iteración varias veces hasta llegar a un set "caricatura" coherente (vía Magnific), reemplazando placeholders.
- Tarjeta "Juega con Brito" agregada al hub principal de módulos; ADMIN puede entrar a revisar el juego.
- Cruce de leads corregido para el caso de un asesor con correo distinto en el CRM (Sara Duarte) — ver memoria de matching Trengo/HubSpot.

---

## Sesión 029 — 2026-07-28/29

**Objetivo:** Separar Ventas y Finanzas en módulos propios, con diseño corporativo.

### Lo que se hizo
- **Nuevo módulo Ventas** (admin y "Mis ventas" para asesor): tarjetas tipo dashboard, gráfica con scrub táctil ("Ritmo del mes"), lupa al deslizar, filtro de clientes por día, variación vs. mes anterior con mismo corte de días.
- Hotmart: se empiezan a registrar pagos a cuotas con el postback crudo guardado; "Cuota 1 de 3" visible en el listado de ventas.
- Reportes/Analíticas: cursos agrupados por línea de producto (familia), tarjeta de "pendiente por cobrar" que responde al selector de fechas.
- **Finanzas pasa a ser un área propia**, no una sección de Ventas: resumen, evolución, mix, cierre mensual, precios oficiales, cupones, atribución — diez secciones en total.
- Rediseño de la pantalla posterior al login (hub de módulos).
- Todos los desplegables nativos reemplazados por el `Select` propio de la app.

---

## Sesión 030 — 2026-07-29/30

**Objetivo:** Pulir visualmente Brito y las comisiones; automatizar Google Ads en Finanzas.

### Lo que se hizo
- Brito: mascota nueva con fondo transparente (reemplaza el logo "B" y la imagen vieja en todo el juego), mapa con diseño de "cuaderno" (aprobado en sesión de diseño), moneda **"Quinis"** con bolsillo animado y modal de canje (`BritoPerfil.quinis`), Poppins heredada globalmente (se quita el reemplazo por Nunito que quedaba en portada/mapa/lección/resultado).
- Comisiones del dashboard rediseñadas como "recibo de liquidación" — iteración varias veces hasta llegar a tres tarjetas blancas con el patrón visual de las tarjetas del dashboard.
- **Google Ads entra automáticamente a Finanzas** (sincronización cada 4h) — ver memoria de la integración para las dos cuentas independientes y el pendiente de acceso básico del developer token.

### Pendientes vigentes (confirmar si siguen abiertos)
- Filtrar broadcast SSE por `asesorId` (sigue siendo global)
- Meta y TikTok en `InversionPublicitaria`
- Exportar reportes CSV/PDF
- Rediseño corporativo en Stitch del resto de módulos (más allá de Ventas)
- `docs/API.md` sigue sin actualizar — pendiente para una próxima sesión

---

## Sesión 031 — 2026-08-04

**Objetivo:** Sumar los gastos internos de la agencia al módulo de Finanzas.

### Lo que se hizo
- **Nuevo panel `Finanzas > Gastos de agencia`** (`/finanzas/agencia`): lee en vivo el Google Sheet de contabilidad interna y muestra indicadores, gasto mensual apilado por categoría, comparación año contra año, participación con variación, observaciones redactadas desde el dato, producción y costo por pieza, nómina del corte y calidad del dato. Hereda el muro de ADMIN del layout de Finanzas.
- **Backend:** `api/src/services/gastosAgencia.ts` (lectura y normalización del sheet, caché de 5 min en memoria) + `finanzasGastosAgencia.controller.ts` + ruta `GET /api/finanzas/gastos-agencia` (`?refrescar=1` salta la caché). Si el sheet no responde se sirve la última lectura buena marcada como desactualizada.
- **Frontend:** `web/src/lib/gastosAgencia.ts` con el motor de análisis. El backend entrega el snapshot normalizado y el cálculo del periodo vive en el cliente: son doce puntos por categoría, así que filtrar por trimestre o apagar una categoría se recalcula al instante sin volver a pedir datos.
- Filtro por periodo con presets (Todo, Últimos 3/6, T1–T4) y rango Desde/Hasta. Con rango parcial el KPI de cierre pasa a **"Ritmo anualizado"**: proyectar el año ignorando meses que ya tienen dato no es una proyección.

### Decisiones que conviene no deshacer
- **`GASTOS_AGENCIA_SHEET_ID` va por entorno, nunca en el código.** Este repositorio es público y el sheet contiene cédulas y números de cuenta.
- **La cédula no se lee del sheet y de la cuenta solo salen los últimos 4 dígitos.** Lo que no se serializa no se puede filtrar; `api/scripts/probar-gastos-agencia.ts` verifica que no haya fugas.
- El parseo del sheet es **por búsqueda de etiquetas**, no por fila/columna fija: el equipo edita ese sheet a diario (cambió tres veces mientras se construía esto).
- Sin filtro de categorías los totales usan la **fila `Total` del sheet**, no la suma de categorías: junio 2025 tiene total sin desglose y sumar categorías se comía $21 M.

### Pendiente para que el panel funcione
- Definir `GASTOS_AGENCIA_SHEET_ID` en Railway. Hasta entonces el panel responde 503 con un aviso de "falta configurar".
- El Google Sheet está compartido como "cualquiera con el link": el panel protege la PII, el sheet no. Conviene restringirlo (y entonces migrar la lectura a una cuenta de servicio de Google).

---

## Sesión 032 — 2026-08-04

**Objetivo:** Que las tablas de `Gastos de agencia` se puedan diligenciar desde la app y que app y sheet queden sincronizados.

### Lo que se hizo
- El panel pasó a **módulo con secciones**: Resumen (el análisis de antes) · Contabilidad · Nómina · Producción · Tarifario. Las cuatro últimas son **tablas editables**.
- **Escritura real sobre el Google Sheet:** `api/src/services/googleSheets.ts` (cuenta de servicio, JWT firmado con `jsonwebtoken`, sin dependencias nuevas) y `gastosAgenciaEscritura.ts` con las operaciones. Rutas: `PUT/POST /api/finanzas/gastos-agencia/{contabilidad,nomina,produccion,tarifario}`.
- La lectura pasa por la API de Sheets cuando hay cuenta de servicio, y cae al CSV público si no. Eso además deja el módulo funcionando si algún día se restringe el sheet.
- Celdas editables en el sitio (Enter guarda, Escape cancela), interruptor Sí/No para el pago y alta de personas en la nómina.

### La decisión de fondo: no hay segunda copia
El sheet es la **única fuente de verdad**; la app no guarda copia en Postgres. Un "sync bidireccional" entre dos copias es exactamente donde se pierden datos: dos ediciones simultáneas se pisan sin avisar. Con un solo almacén no pueden divergir. El costo es que cada edición es una llamada a Google, que para este volumen no se nota.

### Cómo se protege de pisar el trabajo de otro
1. Cada escritura **relee la pestaña** (nunca desde caché).
2. **Reubica la celda por etiqueta**, no por una posición guardada: si alguien insertó una fila en el sheet, la posición vieja apuntaría a otro dato.
3. Compara con el valor que el cliente creía tener y responde **409 con el valor actual** si cambió. El panel muestra "en el sheet ahora dice X" en vez de sobreescribir.
4. En la nómina además verifica que en esa fila siga estando la misma persona, para no cambiarle el pago a quien no es.
5. Tras escribir invalida la caché de lectura.

### Verificado
- `api/scripts/probar-ubicacion-gastos.ts` prueba **en seco** los localizadores: para cada valor editable ubica su celda y compara con lo que reportó el parser. **637 coincidencias, 0 descuadres** (contabilidad de los dos años, 77 personas × 4 campos, producción y tarifario). Correr esto antes de tocar la ubicación de celdas.
- `npx tsc --noEmit`: 0 errores en api y en web. `next build` completo.

### Pendiente
- Crear la cuenta de servicio de Google (Sheets API habilitada), compartir el sheet con su correo como **editor** y poner `GOOGLE_SHEETS_SA_EMAIL` y `GOOGLE_SHEETS_SA_PRIVATE_KEY` en Railway. Sin eso las tablas se ven pero salen en solo lectura con un aviso que lo explica.
- La cédula y el número de cuenta **no se pueden editar desde la app** a propósito: el panel nunca los recibe completos. Se llenan en el sheet.
- No se probó el camino de escritura contra el sheet real (falta la cuenta de servicio). Lo verificado es la ubicación de celdas y el manejo de errores.

---

## Sesión 033 — 2026-08-05

**Objetivo:** Dejar de escribir tokens de sesión en los logs y en Sentry.

### El problema
Los JWT de sesión quedaban en texto plano en los logs de producción, incluida al menos una sesión de ADMIN:

```
url="/api/eventos?token=eyJhbGciOiJIUzI1NiJ9..."
"POST /api/trengo/webhook?secreto=de8215..."
```

Que viajen en la URL **no es un descuido**: `EventSource` no admite cabeceras custom y los webhooks de terceros solo dejan configurar una URL. Van cifrados por HTTPS. El problema era que quedaban **escritos**, y ahí siguen siendo válidos hasta que expiran: cualquiera con acceso a los logs podía tomar una sesión ajena.

### Lo que se arregló
`api/src/utils/redactar.ts` reemplaza el valor de los query params sensibles por `***`, aplicado en los cuatro sitios que los escribían:
1. **morgan** — formato `combined` propio que usa un token `:urlSegura`.
2. El middleware de request que loguea `method` y `url`.
3. El **errorHandler**, que además los mandaba a Sentry a mano.
4. **Sentry mismo** — este era el peor y el menos obvio: `setupExpressErrorHandler` adjunta los datos de la petición por su cuenta, así que redactar en el errorHandler no alcanzaba. Y con `tracesSampleRate: 0.2` la URL viajaba también en el nombre de la transacción y en los atributos de los spans, o sea **en peticiones que ni fallaron**. Se limpia con `beforeSend` y `beforeSendTransaction` en `instrument.ts`.

Además se agregó `redact` de pino por nombre de campo (`token`, `secreto`, `authorization`, `password`…) como segunda red para cuando alguien loguee un objeto con credenciales dentro.

**No cambia cómo se autentica nada**: solo deja de guardar el secreto.

### Verificado en producción
Se mandó una petición con un token centinela en la URL: respondió 401 (el token se sigue leyendo y validando) y en los logs quedó `url="/api/eventos?token=***"`, sin rastro del centinela. `scripts/probar-redaccion.ts` cubre los dos casos reales más los bordes (sin query, valor vacío, mayúsculas, y que `tokenizado` no se toque por parecerse a `token`).

### Si se quiere ir más allá
La redacción resuelve la fuga, pero el token sigue viajando en la URL y eso lo pueden registrar intermediarios que no controlamos (el edge de Railway, por ejemplo). El arreglo de fondo sería un **ticket de un solo uso y vida corta** para SSE: el cliente lo pide con `Authorization`, recibe un ticket de ~30 s y ese es el que va en el query string. Así, aunque quede registrado, no sirve para nada. Es un cambio más grande porque toca `useSSE.ts` y la ruta de eventos.

---

## Sesión 034 — 2026-08-04 / 2026-08-05

**Objetivo:** Dos módulos nuevos en el área de Marketing — **Panel de Edición** (videos aprobados por editor desde Trello) y **Redes** (vincular Instagram/Facebook y programar publicaciones e historias) — más el traspaso operativo de la infraestructura (NexCode97 sale del proyecto).

### Contexto: de dónde viene el Panel de Edición
Antes de tocar este repo se construyó un dashboard standalone en Netlify (`panel.grupo500educacion.co`, sitio `grupo500-editores`) que lee **Trello en vivo**: cuando una líder pasa una tarjeta a una lista de "Aprobados", el panel la cuenta por editor. Ese sitio sigue vivo (acceso rápido sin login) y es la **fuente de datos** del módulo dentro de la app.

Reglas de datos que hay que conocer para mantenerlo:
- Tableros: **"Grupo 500 videos"** (editor = miembros de la tarjeta; cuentan las listas cuyo nombre contenga "aprobad"; las listas de corrección alimentan chips y alertas) y **"TEAM COMMUNITY"** (las tarjetas casi no tienen miembros: el editor es el **nombre de la lista**, y "X" + "X SUBIDOS" se fusionan como la misma persona).
- Varias listas de corrección están escritas **"correción"** (una sola c) — el matcher cubre ambas grafías (`correcci|correci`).
- Las listas "PUBLICADOS …" **no** cuentan como aprobados (decisión de David); ampliable con la env `APPROVED_MATCH` en Netlify.
- La fecha real de aprobación sale del historial de acciones de Trello (máx. 1000): tarjetas viejas caen a `dateLastActivity`, por eso la matriz mensual tiene un pico artificial en jun-2026 que se corrige solo hacia adelante.
- La función de Netlify pide cada tablero en 4 llamadas paralelas + caché en memoria de 55 s (pedir tarjetas lista por lista revienta el timeout de 10 s).
- Credenciales de Trello (key + token) viven como env vars del sitio Netlify, cuenta pregrupo500@gmail.com.

### Panel de Edición dentro de la app (commits `951fb5c`, `8c5fb03`)
- Pestaña **Marketing > Panel de Edición** (`web/src/app/marketing/panel-edicion/page.tsx` + tab en `marketingNav.ts`): resumen (aprobados periodo/hoy/semana, editores activos, en corrección), alertas (🔴 >3 días en corrección, 🟠 3+ acumulados, 🟡 sin aprobados en la semana), ranking por tablero con detalle expandible y matriz mensual por editor (6 meses).
- **Gotcha CSP**: `connect-src` de `next.config.ts` solo permite `'self'` + el API de Railway → el navegador NO puede llamar dominios externos. El panel se veía vacío hasta crear el proxy interno `web/src/app/api/marketing/panel-edicion/route.ts` (route handler con `auth()`, consulta la Netlify Function server-side y sirve same-origin).

### Módulo Redes (commits `ae33cdd`, `533eb91`, `9797d57`)
Programar posts, historias y reels en Instagram/Facebook vía la **Graph API de Meta** (v21.0), todo dentro de la app:
- **Modelos** (`migración 20260805000000_redes_sociales`, YA APLICADA en producción): `redes_cuentas` (página FB o IG profesional, con su page access token — nunca sale del API) y `redes_publicaciones` (tipo POST/HISTORIA/REEL, media en Cloudinary, `programadaPara`, estado PROGRAMADA→PUBLICANDO→PUBLICADA/ERROR/CANCELADA).
- **API** (`/api/redes`, roles ADMIN/MARKETING/EDITOR/COMMUNITY; config solo ADMIN): `routes/redes.ts`, `controllers/redes.controller.ts`, `services/metaGraph.service.ts`.
- **OAuth**: la App de Meta es tipo Negocios → el diálogo NO acepta scopes sueltos ("Invalid Scopes"); usa una **Configuración** de *Facebook Login for Business* pasada como `config_id`. Credenciales en la tabla `ConfigApp` (claves `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`) — se editan desde la propia pantalla de Redes (engranaje, solo admin). El callback aterriza en `/marketing/redes/callback`, que canjea el code en `POST /api/redes/conectar`; al autorizar se vinculan todas las páginas FB del usuario y sus IG profesionales (`/me/accounts`).
- **Publicador**: `jobs/publicarRedes.ts` corre cada minuto (`setInterval` en `index.ts`); toma las programadas vencidas con candado por `updateMany` de estado, publica y marca resultado. Blindado para no tumbar el proceso si la BD falla.
- Particularidades de Meta implementadas: IG exige JPEG/MP4 (la URL de Cloudinary se transforma sola con `f_jpg`/`vc_h264`); IG video usa media container + espera de procesado + `media_publish`; los videos de feed IG van como REELS; historias FB usan `photo_stories` / `video_stories` (flujo start→upload por `file_url`→finish).
- **CSP ampliada**: `img-src` acepta CDNs de Meta (avatares) y se agregó `media-src` para previews de video de Cloudinary.
- UI: pantalla Redes con setup guiado de la App de Meta, chips de cuentas vinculadas, composer (tipo, multi-cuenta, media, fecha/hora) y listas de próximas + historial con reintento/cancelar/eliminar.

### Traspaso de infraestructura (importante para todo el equipo)
- **NexCode97 ya no participa.** La operación queda en el equipo con la cuenta pregrupo500@gmail.com.
- La BD de producción es el **Postgres del propio proyecto Railway "App Grupo 500"** (servicios `Postgres` y `Backend`), NO Neon como dicen los docs viejos.
- **El deploy de Railway NO corre migraciones** (`build: prisma generate && tsc`). Se aplican a mano:
  ```bash
  cd api
  railway link --project "App Grupo 500" && railway service Backend
  DB=$(railway variables --service Postgres --json | python -c "import json,sys; print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
  DATABASE_URL="$DB" DIRECT_URL="$DB" npx prisma migrate deploy
  ```
  (Railway CLI con sesión de pregrupo500@gmail.com. La URL interna `postgres.railway.internal` no sirve desde fuera; usar `DATABASE_PUBLIC_URL`.)
- Vercel (proyecto `appgrupo-500`) y Railway despliegan solos con cada push a `main`. El remoto se mueve rápido: `git pull --rebase` antes de cada push.

### Pendiente (próxima sesión)
- David crea la **Configuración** en *Facebook Login for Business* (token de usuario + los 6 permisos: `pages_show_list, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, business_management`) y guarda el **Config ID** en la pantalla de Redes → probar "Conectar con Meta" → primera publicación de prueba (sugerido: historia con imagen en IG).
- La app de Meta está "En desarrollo": solo administradores de la app pueden autorizar (suficiente para páginas propias). Para páginas de terceros se necesitaría App Review.
- Ideas siguientes del área Marketing: carruseles IG, integrar lo programado al Calendario de contenido, metas por editor en el Panel de Edición.

---

## Sesión 034 — 2026-08-05

**Objetivo:** Cerrar del todo la fuga de tokens del SSE con un ticket de un solo uso.

### Por qué hacía falta, si ya se redactaban los logs
La sesión 033 dejó de escribir el JWT en **nuestros** logs y en Sentry. Pero el token seguía viajando en la URL, y eso lo puede registrar cualquier intermediario que no controlamos: el edge de Railway, un proxy corporativo, una extensión. Un JWT de sesión vive una hora; con eso alcanza para robar la sesión.

### Cómo quedó
`POST /api/eventos/ticket` autentica por cabecera `Authorization` (donde nadie la registra) y devuelve un **ticket opaco de 32 bytes, de un solo uso y 30 segundos de vida**. Eso es lo único que va en la URL del `EventSource`. Aunque quede registrado, ya no sirve.

- `api/src/utils/ticketsSSE.ts` — emisión, consumo (borra antes de validar la caducidad, para que un ticket presentado tarde tampoco se pueda reintentar), purgado y techo de 5.000 entradas.
- El almacén es **en memoria**, igual que `sseManager`, que ya guarda las conexiones en un `Set`. Los dos comparten el supuesto de una sola instancia; si algún día se escala a varias réplicas, el broadcast de SSE se rompe **antes** que esto, así que no es este archivo el que habría que cambiar primero.
- `useSSE.ts` pide el ticket antes de cada conexión y cierra el `EventSource` a mano en `onerror`, para que no reintente solo con un ticket ya gastado y se quede en bucle de 401.

### Transición
Se mantiene la rama que acepta `?token=`, con un warning `sse_token_legado`. **Se justificó a los 20 segundos de desplegar:** un usuario real se reconectó por ahí porque su pestaña tenía el bundle viejo. Sin esa rama se habría quedado sin eventos en vivo hasta recargar. Cuando el warning deje de aparecer en los logs, se puede borrar la rama.

### Dos fugas más que se cerraron de paso
- `ticket` entró en `PARAMS_SENSIBLES`: ya es de un solo uso, pero mientras vive abre una conexión.
- `logSecurityEvent` en `auth.ts` registraba `req.originalUrl` sin redactar. Hoy no filtraba nada porque ningún endpoint con credencial en el query usa ese middleware, pero lo haría en cuanto alguien añadiera uno.

### Verificado en producción
`/api/eventos` sin nada → "Ticket requerido". Con un ticket inventado → rechazado, y en los logs quedó `ticket=***`. `POST /eventos/ticket` sin sesión → 401. El preflight de CORS desde `grupo500educacion.co` devuelve 204 permitiendo `POST` con `Authorization` (era el eslabón que habría roto todo en silencio). `scripts/probar-tickets-sse.ts` cubre el ciclo: el segundo uso falla, los vencidos fallan, dos tickets no se interfieren y el mapa no acumula basura.

**Lo que no se probó:** el navegador haciendo el ciclo completo. Requiere una sesión real y no se usó ninguna: mintear un JWT con `NEXTAUTH_SECRET` habría significado suplantar a un usuario existente. Se confirma recargando la app y viendo `via="ticket"` en los logs.

### Nota aparte
Un origen no permitido en CORS responde **500** en vez de 403, porque el rechazo se lanza como excepción y cae en el errorHandler. Además de ser un código engañoso, cada petición bloqueada genera un evento en Sentry. No se tocó por estar fuera de alcance.

---

## Sesión 035 — 2026-08-06

**Objetivo:** Conectar Google Ads al módulo de Finanzas y arreglar dos fallas de la ficha financiera del estudiante.

### Google Ads entra solo al módulo de Finanzas

La inversión publicitaria se tecleaba a mano. Ahora un trabajo programado (`api/src/jobs/sincronizarGoogleAds.ts`, cada 4 horas) trae el gasto diario por campaña vía `api/src/services/googleAds.ts` y lo guarda en `InversionPublicitaria`, de donde salen el CAC y el MER.

**Por qué sincronizar y no consultar en vivo:** Google tiene tope de operaciones diarias y las cifras del día en curso se siguen ajustando durante horas (clics inválidos, conversiones tardías). Consultar en cada carga del dashboard sería lento y quemaría cuota sin traer números más firmes. Cada corrida reescribe la última semana completa para recoger esos reajustes retroactivos.

Tres cosas que costaron descubrir y quedaron en el código:

- **Las dos cuentas son independientes, no están en jerarquía.** `738-354-7272` es donde corren las campañas; `618-761-7649` figura como administradora pero la otra no cuelga de ella. Mandar `login-customer-id` produce 403. Por eso la cabecera solo se envía si existe la variable de entorno.
- **La cuenta factura en COP**, así que el costo (que llega en micros) no pasa por TRM.
- Se descartan las filas sin gasto ni impresiones: la cuenta arrastra decenas de campañas pausadas.

La tabla ganó `campaniaId` y `fuente` (MANUAL / API) con índice único por plataforma, campaña y día (migración `20260730162645_inversion_fuente_campania_id`). Sin eso, resincronizar duplicaría el gasto y hundiría el CAC; como en Postgres los nulos no colisionan, las filas cargadas a mano quedan libres. Credenciales en Railway (`GOOGLE_ADS_*`, servicio Backend).

**Pendiente:** el developer token sigue en nivel "Acceso al Explorador". Ya permite leer producción (verificado), pero tiene techo de cuota; falta que David solicite el acceso básico en Google Ads → Herramientas y configuración → Centro de API. Lo aprueba un humano y tarda días.

### La barra de progreso de pago mentía

`montoPagadoPago` multiplicaba el monto por el número de cuota. Eso valía cuando Hotmart guardaba **una sola fila por compra** que se iba actualizando, pero hoy manda un webhook por cada cobro y cada uno trae su propia referencia. Al sumar filas se contaba de más: dos cuotas de $226.900 mostraban $680.700 en vez de $453.800. Eran 32 estudiantes.

Antes de tocarlo se comprobó que el modelo antiguo ya no existe en los datos: 267 filas en partes, 267 referencias distintas, cero casos de una sola fila con cuota mayor que uno. La función ahora devuelve `p.monto` y ya está.

Efecto lateral importante: el saldo pendiente que reporta `reportes.controller.ts` usaba esa misma función, así que **venía subestimado**. Ahora refleja la deuda real.

### Las cuotas atrasadas eran invisibles

Los 2.554 pagos de la base están en `PAGADO`. No hay ni uno en `PENDIENTE` ni en `VENCIDO`, y **nada en el código escribe `VENCIDO` nunca** — el estado existe en el enum, la interfaz lo pinta de rojo y los reportes lo suman, pero jamás se asigna.

La razón de fondo: las cuotas que Hotmart todavía no ha cobrado **no existen como registro**, porque Hotmart solo avisa cuando efectivamente cobra. De 235 compras a plazos, 192 están incompletas.

Se resolvió **derivando** el plan (`web/src/lib/cuotas.ts`) en vez de sembrar filas. Sembrarlas contaminaría las cifras de facturación, porque Finanzas cuenta filas de pago para calcular ventas. Derivado además significa que el atraso se recalcula contra la fecha de hoy en cada render, sin depender de que ningún proceso corra.

La ficha muestra las cuotas por cobrar con su fecha estimada, y en rojo las vencidas con los días de atraso; el listado suma esa mora al semáforo. La proyección parte del **último** cobro y no del primero, porque usar el primero acumula el desfase de los reintentos de Hotmart.

**Criterio unificado:** el módulo de Cuotas ya trataba esto con ciclo de 30 días y 37 antes de dar por atrasada (7 de gracia, porque Hotmart reintenta). La ficha usaba mes calendario sin gracia, así que las dos pantallas se habrían contradicho sobre el mismo estudiante. Ahora comparten los números, anotados en ambos lados. Resultado: 13 planes con cuota vencida y $3.039.989 de mora visible.

### Código muerto retirado

No existe modelo de `Financiamiento` ni de `Cuota` en el esquema, ni el API los devuelve, así que el arreglo siempre llegaba vacío: la mora sumaba cero, la sección no se pintaba nunca y el formulario de abonos no se abría jamás. Se fueron las dos interfaces, los componentes `FilaCuota` y `FormAbono`, la sección de abonos y los cálculos asociados. **472 líneas** que aparentaban una funcionalidad inexistente.

### Pendiente que NO se tocó, por ser decisión de producto

En el formulario de crear estudiante sigue viva la opción de pago **FINANCIADO** con su configurador de cuotas, pero **el backend no tiene esa rama**: el esquema Zod de `crear` ni siquiera acepta el campo `cuotas` (lo descarta en silencio) y después del bloque de contado va directo al `return`. El asesor llena el plan, guarda, y no queda ningún registro. Eso explica que no exista ni un pago `PENDIENTE` en la base.

Hay que decidir entre **implementar la rama en el backend** o **retirar la opción del formulario**. Dejarla como está significa que cualquier venta financiada que no pase por Hotmart se pierde sin aviso.

---

## Sesión 036 — 2026-08-10

**Objetivo:** Adaptar el PRD del cliente "Plataforma de Simulacros Tipo ICFES" a la plataforma real.

### PRD adaptado — nueva área de simulacros

El cliente entregó un PRD (v0.1) que asumía construir una app nueva desde cero con NestJS. Antes de adaptar nada se auditó el repo y la conclusión cambió el plan: **el motor de exámenes existente (`/examenes`, tablas `sim_*`) ya cubre la mayor parte del alcance** — login de estudiante por correo+documento, dos sesiones con cronómetro autoritativo del servidor con pausas, banco de preguntas con opciones A–H e imágenes, hoja de respuestas única con bloqueo de S1, y calificación 0–100 por área + global 0–500 cuya fórmula de pesos 3/3/3/3/1 es matemáticamente idéntica a la del PRD.

Quedó escrito `docs/PRD-SIMULACROS.md` con: el mapa de lo que ya existe, las brechas reales (accesos diferenciados por producto + CSV, video de corrección por pregunta, informe automático por colegio con PDF y correo, subrayado, cronómetro negativo, ajuste por tramos), los cambios de schema propuestos (`sim_accesos`, `videoUrl`, `sim_informes`), 7 decisiones a confirmar con el cliente (la primera: OTP vs. documento — se recomienda mantener documento) y 6 fases de implementación.

Dos bloqueos identificados que no dependen de código: la regla de ajuste por tramos del calificador se solapa en el documento original (el propio PRD la marca "por confirmar") y el servicio de correo saliente del API sigue siendo un stub — lo necesitan tanto el informe por colegio como el OTP si se aprueba.

### Fase 1 implementada: accesos diferenciados por producto

David aprobó el PRD (se mantiene el login por documento, sin OTP) y se construyó la fase 1 en la misma sesión.

**Migración `20260810175639_sim_accesos_diferenciados`:** tabla `sim_accesos` (estudiante×examen, único, con `habilitado_at`/`retirado_at` — retirar oculta sin borrar histórico) y columna `tipo_documento` en `sim_estudiantes`. La migración trae un **backfill**: hasta ahora todo estudiante veía todos los exámenes, así que se crearon los accesos explícitos para cada par existente (69 estudiantes × 3 exámenes = 207 accesos) y nadie perdió visibilidad con el deploy. El banco interno de Brito (id 9999) queda excluido.

**Cambios de comportamiento:** el listado `/examenes` ahora filtra por accesos activos para rol `ESTUDIANTE` (admin sigue viendo todo) y muestra el estado del producto (Pendiente / En curso / Calificado); `/examenes/[id]` rechaza presentar sin acceso activo, pero `/resultado` no pasa por el muro — retirar un acceso conserva el resultado consultable.

**Carga masiva CSV** en `/examenes/admin/accesos`: columnas `nombre, tipo_documento, documento, correo, colegio, productos` (IDs internos separados por espacio, `;` o `|`). Valida fila por fila **sin abortar la carga** y reporta errores con número de fila de Excel; upsert de estudiante por correo (documento → hash, jamás en claro), accesos nuevos o reactivados, colegio cruzado por nombre normalizado y creado con ciudad "Por definir" si no existe (queda avisado en el reporte). El parser soporta comillas, BOM y detecta delimitador `,` o `;` (Excel es-CO exporta con `;`). También quedó la acción `retirarAccesosDeExamen` (baja de producto del PRD §6.2), aún sin botón en la UI.

**Gotchas de esta sesión:**
- Para migrar desde local: la `DATABASE_URL` del servicio Backend apunta a `postgres.railway.internal` (no resuelve fuera de Railway). Hay que usar `DATABASE_PUBLIC_URL` del servicio **Postgres** (`railway variables --service Postgres --kv`) y exportar también `DIRECT_URL` (el schema la exige).
- El typecheck de web se cae con "Cannot find module framer-motion" si el `node_modules` local está viejo — es `pnpm install`, no el código.

### Fase 2: cronómetro negativo y subrayado

**Cronómetro rojo negativo (PRD §8.3):** al llegar a 0:00 la sesión ya **no se auto-envía** — se quitó el cierre automático tanto del server (`page.tsx` cerraba el intento al cargar con tiempo vencido) como del cliente. El reloj continúa en rojo con signo negativo y la etiqueta cambia a "Tiempo extra". Al finalizar cada sesión se acumula el tiempo transcurrido en `sesionNConsumidoSeg` y se limpia `iniciadoEn`, así que el tiempo total real (incluido el adicional) queda registrado por sesión.

**Subrayado (PRD §8.5):** botón "Resaltar" en el header del examen. Con el modo activo, seleccionar texto del contexto o del enunciado lo subraya en amarillo; un clic sobre un subrayado lo quita; los rangos solapados se fusionan. Se pinta con la **CSS Custom Highlight API** (registro `sub-examen`) para no mutar el DOM que React controla — nada de `<mark>` inyectados. Cada bloque subrayable lleva `data-sub-clave` (`c<id>` contexto, `e<id>` enunciado) y los rangos se guardan como offsets sobre el texto plano del bloque, en el JSON `respuestas` bajo la clave `sub` (el calificador solo lee `s1`/`s2`, no choca). Mismo esquema de persistencia que las respuestas: respaldo inmediato en localStorage + guardado al servidor con debounce + flush al ocultar la pestaña. En navegadores sin la API el botón no aparece.

La negrilla del encabezado de lectura crítica ("Responda las preguntas X a Y…") ya la cumplía el `contexto-label` existente. La fidelidad visual fina contra los PDF S4 queda pendiente de que David entregue los archivos.

**Verificado E2E en producción** con un estudiante desechable (creado y borrado en la misma sesión, DB quedó idéntica: 69 estudiantes, 207 accesos): el listado solo muestra el examen con acceso y con chip "Pendiente"; `/examenes/1` sin acceso redirige al listado; subrayar pinta, persiste en `respuestas.sub` del servidor tras recargar y se quita con clic; con el tiempo agotado el examen NO se auto-envía y el reloj muestra "Tiempo extra −00:0X:XX" en rojo. Ojo al probar en el navegador embebido: `btn.click()` programático no dispara el onClick de React ahí — hay que clicar por CDP (`computer` con ref); no es bug del producto. Para correr el web local contra la DB real: `web/.env.local` (gitignored) con la `DATABASE_PUBLIC_URL` de Railway y secretos de auth de relleno.

### Auditoría de fidelidad: Simulacro 2 vs PDFs S-2 (cierre de fase 2)

David entregó los PDFs fuente del Simulacro 2 (el que está en producción). Se auditó **toda** la digitalización contra ellos por script (parseo del PDF + cruce con `sim_preguntas`): estructura exacta — 120+124 preguntas, áreas 25/41/25/29 y 25/25/29/45, 15/15 rangos de contexto en sesión 1, enunciados de inglés (cloze y comprensión) literales al PDF. Las preguntas sin opciones de texto (10) las tienen dentro de su imagen, como el cuadernillo.

**4 correcciones de datos aplicadas en producción:**
1. **Inglés P80–84**: la DB ofrecía la opción H como marcable; el PDF manda "marque A–G" (la H es del ejemplo). Se quitó `opcionH` — la palabra H sigue visible en el banco del contexto.
2. **Inglés P90–94**: enunciados alineados al PDF («¿Dónde puede ver este aviso?», sin tuteo ni "(ver imagen)») y P94 recibió el contexto compartido para agruparse 90–94 como en el cuadernillo.
3. **Matemáticas S2 P42**: enunciado reescrito que además tenía el typo «P, Q, R y s» → texto literal del PDF (la tabla vive en la imagen).
4. **Escala de grises**: 2 de 88 imágenes estaban a color (S1 P26 cómic, S1 P102 planta). Se resolvió **sin re-subir**: transformación `e_grayscale` de Cloudinary insertada en la URL (`/upload/e_grayscale/`), verificada con análisis de canales (colorido 0.0 tras aplicar).

**Gotcha del análisis**: el texto extraído del PDF trae las opciones de inglés en columnas desordenadas y los números de página pegados — la mayoría de las 64 alertas del script eran ruido de extracción; solo se actuó sobre lo confirmado a mano contra el PDF.

También quedó el **botón "Retirar" por producto** en `/examenes/admin/accesos` (con confirmación, usa `retirarAccesosDeExamen`): oculta el simulacro a los estudiantes conservando resultados.

### Algoritmo de calificación confirmado e implementado (fase 5)

El cliente entregó la regla exacta del ajuste ("Algoritmo de calificación — Plataforma de Simulacros"): **cascada de dos pasos**, no la tabla por tramos solapada del borrador. base 100 → 100; base 11–99 → −10 y, si el resultado cae en 85–89, −4 adicional; base 0–10 → igual. Efecto neto: 95–99 → −14, 11–94 → −10. El global sigue siendo el ponderado 3/3/3/3/1 ÷13 ×5 sobre las materias **ya ajustadas**.

Quedó en `ajustarPuntajeMateria()` (`web/src/lib/calificacion.ts`), aplicada en `calificar()` y en la página de resultado — que calculaba las áreas con lógica propia duplicada sin ajuste; ahora importa la lib compartida. Verificado contra los 10 ejemplos del documento (99→85, 95→81, 94→84…), el global de ejemplo (405) y un caso de punta a punta con `calificar()`.

**Los 15 intentos finalizados del Simulacro 2 se recalcularon** con la regla nueva (bajaron ~40–70 puntos de global, p. ej. 482→413, 458→403): sin esto, la página de resultado (que recalcula áreas en vivo) habría mostrado áreas ajustadas junto a un global viejo sin ajuste, y los promedios del admin y el futuro informe por colegio quedarían mezclando dos reglas. El recálculo es determinista desde `respuestas` + `correcta`: quitar el ajuste y re-correr lo revierte.

### Pendiente (próxima sesión)
- Hosting de videos de corrección (fase 3): decisión Cloudinary firmado vs Bunny + los videos
- Membrete + "Logos" + informe institucional de ejemplo para la fase 4 (informe por colegio)
- Servicio de correo saliente (Resend recomendado) — lo exigen las fases 4 y el OTP si se aprueba

---

## Sesión 037 — 2026-08-13

**Objetivo:** Marca de agua del logo en el tapiz del mapa de Brito.

### Marcas de agua en el sendero de Brito

El tapiz del mapa (`/brito/mapa`, la "hoja de cuaderno") ahora lleva el logo de Grupo 500 como marca de agua repetida. Implementación: un tile PNG (`web/public/brito/tapiz-logo.png`, 480×480) generado desde `public/logo.png` con la opacidad (~5,5%) **horneada en el PNG** y dos logos escalonados por tile rotados −12° como los garabatos. Se suma como primera capa del `backgroundImage` del sendero, junto a la cuadrícula existente — cero DOM extra, una sola petición cacheable.

**Por qué horneada y no CSS:** un `background-image` no acepta `opacity`, y espaciar un patrón con `background-repeat` exige que el propio tile traiga el aire alrededor del logo. Regenerar el tile (cambiar tamaño/opacidad/densidad): script inline de PIL sobre `public/logo.png`, documentado en el comentario del componente.

---

## Sesión 038 — 2026-08-14

**Objetivo:** Panel de administración, roles del equipo de marketing y las cuentas de cobro freelance de punta a punta.

### Panel de Administración

Área propia en `/admin` (tarjeta en `/inicio`, azul marino del chrome de la app), con muro solo ADMIN. Se le mudaron —con `git mv`, conservando historial— Ventas generales, Usuarios y Brito, que vivían dentro de Ventas por herencia y un vendedor nunca vio. Delante va un **Resumen general** alimentado por `GET /reportes/resumen-general`: un solo lote de consultas para que las cifras de las tres áreas salgan de la misma foto. En Ventas quedó el enlace "Ver todas las ventas" para que un admin no se quede sin lista de ventas junto a los estudiantes que las generan.

### Roles

Fuera el rol `MARKETING` del selector: nació como el rol genérico del área antes de que existieran los cinco oficios y no lo tiene ninguna cuenta (verificado en producción). Sigue en `ROL_LABEL` y en el enum por si apareciera una cuenta vieja — un `<select>` no puede mostrar seleccionado un valor que no está entre sus opciones, y en blanco era justo el bug que había. "Vendedor" pasa a llamarse **Asesor** en pantalla; el valor `VENDEDOR` de la base no cambió. La lista de Usuarios va partida por área (Administración / Ventas / Marketing) con su conteo.

### Ajustes para todo el mundo

`/ajustes` vivía dentro de `(dashboard)`, cuyo muro manda a `/inicio` a quien no sea admin o asesor: el equipo de marketing oprimía Ajustes y rebotaba sin llegar nunca a su perfil. Se mudó a la raíz con su propio muro (solo queda fuera el estudiante). Además leía el nombre y el teléfono de la ficha de **asesor**, que marketing no tiene: ahora todo sale de `/auth/me` y se guarda con un `PATCH /auth/me` que escribe donde corresponda según quién sea.

### Cuentas de cobro freelance

El formulario de la landing pedía diez datos cada vez. **Seis son de la persona** y no cambian de un mes a otro; los otros cuatro —fecha, periodo, concepto y valor— ya los tiene la app en el propio `ContenidoMarketing`. Así que los seis viven ahora en `MiembroMarketing` (identificación, cuenta bancaria, RUT y la firma dibujada) y se llenan una vez en Ajustes. El estado ("te faltan dos datos para que te podamos pagar") lo calcula `utils/cuentaCobro.ts`, un solo sitio que consultan Ajustes y Cobros — así la líder ve el problema antes de aprobar algo que después no se va a poder pagar.

El PDF se arma **en el navegador** con jsPDF (`web/src/lib/cuentaCobroPdf.ts`, incluye el valor en letras) y se manda al servidor ya hecho: lo que queda archivado es exactamente el archivo que la persona vio, no una segunda versión dibujada por otro código. Se descarga antes de subir, para que un fallo de Drive no la deje sin su cuenta de cobro.

**Cobros** pasa a entrarse por una tabla de liquidación —una fila por persona, sus tres montos en columnas y el RUT debajo del nombre— porque a un freelance no se le hacen cinco transferencias sino una. El filtro de persona hace de conmutador: al elegir a alguien se abre el detalle de sus trabajos. Aprobar y pagar en lote van con un `updateMany` que lleva el estado de origen en el `where`, así que una fila que cambió entretanto no entra: no hay forma de pagar dos veces ni de saltarse la aprobación.

### Google Drive: por qué NO con la cuenta de servicio

Los PDF caen en la carpeta *Cuentas de Cobro - Grupo 500* (`19kcOxrAS19fhoAoa32U02qq6_DsjA1kr`). El primer intento fue con la cuenta de servicio de Sheets (`gastos-agencia@durable-zoo-504020-q5`): habilitada la Drive API y compartida la carpeta como Editor, **ve la carpeta y hasta crea subcarpetas**, pero al subir un archivo Google responde `403 · Service Accounts do not have storage quota` — no tiene almacenamiento propio, así que un archivo suyo en "Mi unidad" de alguien no tiene a quién cobrarle el espacio. Las salidas que da Google son unidades compartidas (no existen en una cuenta personal como pregrupo500@gmail.com) o entrar en nombre del usuario.

Se hizo lo segundo: **refresh token de la cuenta dueña**, igual que ya se hacía con Google Ads, reutilizando su mismo cliente OAuth (`DRIVE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` en Railway). El redirect que sirvió fue `http://localhost:8080`, que ya estaba autorizado en ese cliente. Los archivos quedan a nombre de David y ocupan su cuota.

**Estructura:** `2026-08 Agosto / Primera quincena - Marketing`. La carpeta del mes se **comparte** con la landing —se busca por nombre exacto, mismo formato, para entrar en la que exista en vez de duplicarla—; el apellido *Marketing* va en las quincenas, porque esa landing la usa toda la empresa y también crea carpetas sola. Manda la fecha del trabajo, no la de aprobación. Probado contra la carpeta real con una fecha de cada quincena y limpiado después.

### Otros arreglos

- Fotos de Google en los avatares de marketing: la app ya las guardaba al entrar, pero los avatares estaban dibujados a mano en tres pantallas y ninguno las leía. Ahora hay un solo `AvatarMiembro`.
- **Entregables** pasa a ser la lista de tareas de cada quien: listaba solo enlaces ya publicados, así que lo pendiente era invisible por construcción. Sale del calendario, no de la tabla de entregables.
- Simulacros y Marketing dejan de repetir el color de otro módulo (violeta y magenta). El ámbar significa "pendiente" en el resto de la app.

### Ajustes: los datos reales y el teléfono con su país

El correo salía en blanco aunque estuviera en la base: `/auth/me` respondía `{ data: { data: {...} } }` y la pantalla leía un nivel de menos. Se muestra pero no se edita — es la llave con la que se entra y con la que Google reconoce la cuenta.

**El nombre no se reflejaba en la plataforma** aunque se guardara bien: el callback `jwt` leía el nombre de la base *solo si el token no lo traía*, y el login siempre lo trae desde Google, así que el de la base no ganaba nunca —ni volviendo a entrar—. Ahora la base manda, y el token se relee al entrar, al guardar el perfil y **si lleva más de cinco minutos sin hacerlo**: una consulta cada cinco minutos por persona en vez de una por navegación. De paso arregla que un cambio de rol hecho por un admin no se veía hasta cerrar sesión.

El teléfono lleva selector de país (200 países, `web/src/lib/paises.ts`) y guarda el número completo `+57 3164134212`. Los guardados sin `+` se leen como colombianos. La bandera es emoji dentro de una cajita: Windows no trae esos glifos y los pinta como las dos letras del país, que dentro de la caja se lee como insignia. Dibujar 200 banderas a mano no era viable — la de Colombia sí estaba dibujada mientras fue la única.

### Requiere gestión: contexto para saber a quién llamar

La lista daba nombre, curso, método y saldo; para decidir si valía la pena llamar había que salirse a la ficha. Ahora cada fila trae los días en silencio como etiqueta, la barra de cuánto lleva abonado del total, el HP (`pago.referenciaPago`) con botón de copiar, el último abono con su método, la fecha de compra y el documento. **Nada de eso es campo nuevo**: la consulta ya lo calculaba todo para sacar el saldo y lo botaba.

Cambia el orden: **por días sin abonar en vez de por monto**. El reloj arranca en el último abono, o en la compra si nunca abonó. Verificado contra producción — 11 estudiantes, $3.488.922; el caso que lo justifica es uno que debe $2.550 de $430.002 y lleva 57 días: con "saldo $2.550" a secas nadie sabía si era deuda real o residuo de redondeo.

No se puso "Registrar pago" en el modal: el formulario completo ya existe en la ficha y duplicarlo a medias en una ventana de consulta era peor.

### Azul para actuar, claro para consultar

El encabezado azul marino del `Modal` nació para formularios, donde la ventana es un objeto con una acción y la franja se lee como su barra de título. En una ventana de consulta pesaba más que su contenido: tres fondos apilados en los primeros 120px. El componente gana `tono` (claro por defecto, `marca` donde se gana el peso: crear contenido y programar publicación), `icono` —el mismo cuadrito de las tarjetas del dashboard, solo en claro porque sobre el azul no se distingue— y `extra`, que carga el total de lo que se está viendo en el hueco que antes quedaba vacío.

### Email marketing a compradores de Ruta 500 (sin ejecutar)

373 compradores contando combos, **100% con correo válido y sin duplicados**, comprados entre el 29-jun y el 15-ago-2026. 367 celulares colombianos válidos. Se desaconsejó enviar desde Gmail personal (tope de 500/día, sin unsubscribe, y es la cuenta dueña de GitHub/Railway/Vercel/Drive/Meta). **Cerrado sin construir nada: David lo envió desde el email marketing de Hotmart**, que ya tiene la lista de compradores y resuelve unsubscribe y métricas por su cuenta. Queda la consulta de la lista por si alguna vez se necesita fuera de Hotmart. Para WhatsApp masivo: Wassenger (no oficial, riesgo de baneo, inmediato) vs Cloud API de Meta (plantilla aprobada, ~USD 5–11 por 367, cero riesgo) — sin decidir.

### Pendiente (próxima sesión)
- Prueba de punta a punta de la cuenta de cobro con un trabajo freelance real aprobado
- Cruce de los cobros aprobados con Finanzas: ¿se escriben en el Sheet de contabilidad o se leen de la app? — decisión de David
- Pagar de verdad desde la app exigiría conectar un banco o pasarela (Bancolombia empresas, Nequi negocios, Wompi): contrato y credenciales aparte
