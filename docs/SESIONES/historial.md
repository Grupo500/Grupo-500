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
- PDF de T&C: el usuario lo pasará para subir a Cloudinary y actualizar el link en el formulario
- Formularios Cal B y Cal C (misma estructura, diferente calendario)
- Twilio WhatsApp real
- Exportar reportes CSV/PDF
