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
