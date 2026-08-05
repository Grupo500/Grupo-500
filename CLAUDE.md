# Grupo 500 - Instrucciones de Desarrollo

Este documento contiene las instrucciones y contexto para trabajar en el proyecto Grupo 500.

## Visión General

Grupo 500 es una plataforma SaaS para gestión y venta de cursos virtuales de preparación para el ICFES. Incluye:
- Gestión de estudiantes y acudientes
- Sistema de pagos y financiamientos (cuotas)
- Calendario de cobros con integración WhatsApp
- Generación de certificados
- Importación y análisis de simulacros (PDFs)
- Reportes avanzados con estadísticas de ventas y rendimiento
- Área de Marketing: calendario de contenido, entregables, guiones, Panel de Edición (Trello) y Redes (programar publicaciones/historias en IG y FB)

## Stack Tecnológico

### Frontend (Next.js)
- **Framework:** Next.js 15 + App Router
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS v4 + shadcn/ui
- **Auth:** NextAuth v5 (Google OAuth) — ya NO es Clerk
- **Datos:** TanStack Query
- **Gráficas:** Recharts
- **PDFs:** jsPDF, react-pdf
- **Almacenamiento:** Cloudinary
- **Deploy:** Vercel

### Backend (Express)
- **Framework:** Express.js 4 + TypeScript
- **ORM:** Prisma
- **Auth:** JWT HS256 emitido por el web (`/api/auth/token`, secreto NEXTAUTH_SECRET compartido) — ya NO es Clerk
- **DB:** PostgreSQL en Railway (servicio `Postgres` del mismo proyecto) — ya NO es Neon
- **Colas:** Bull Queue
- **Integraciones:** Twilio (WhatsApp), SendGrid (emails)
- **Deploy:** Railway

### Infraestructura
- Monorepo con `pnpm workspaces`
- PostgreSQL en Railway (proyecto "App Grupo 500", servicios `Postgres` y `Backend`)
- Cloudinary para assets
- Railway para backend (`api-production-79572.up.railway.app`) — **el deploy NO corre migraciones**: aplicarlas a mano con `prisma migrate deploy` usando la `DATABASE_PUBLIC_URL` del servicio Postgres (Railway CLI; ver Sesión 034 del historial)
- Vercel para frontend (dominio productivo: `grupo500educacion.co`)
- Push a `main` despliega ambos automáticamente

## Estructura del Proyecto

```
grupo-500/
├── web/              # Frontend Next.js
├── api/              # Backend Express
├── docs/             # Documentación
│   ├── ARQUITECTURA.md
│   ├── API.md
│   └── SESIONES/historial.md
├── .github/
│   └── workflows/    # GitHub Actions
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

## Ambiente de Desarrollo

### Variables de Entorno

**api/.env.local:**
```
# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Database
DATABASE_URL=postgresql://...

# Cloudinary
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Twilio (futuro)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Server
PORT=3001
NODE_ENV=development
```

**web/.env.local:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Setup Inicial

```bash
# Instalar dependencias
pnpm install

# Setup base de datos
cd api
npx prisma migrate dev --name init

# Arrancar servidores
# Terminal 1:
cd api && pnpm dev

# Terminal 2:
cd web && pnpm dev
```

## Fases de Desarrollo

### Fase 1: Backend (Sem. 1-2)
- Setup monorepo, Express, Clerk, Prisma
- Todas las APIs CRUD completas
- WhatsApp como stub (log solamente)
- Testing con Postman

### Fase 2: Frontend (Sem. 3-4)
- Setup Next.js + Clerk
- Dashboards (admin y vendedor)
- Tablas y formularios
- Integración con APIs

### Fase 3: Polish & Deploy (Sem. 5)
- Diseño visual
- OWASP security review
- Deploy a Railway (api) + Vercel (web)

## Convenciones de Código

### Backend
- Rutas en `api/src/routes/`
- Servicios en `api/src/services/`
- Controllers en `api/src/controllers/` (si no es simple)
- Validación con Zod
- Error handling uniforme

### Frontend
- Componentes en `web/components/`
- Páginas en `web/app/`
- Hooks custom en `web/hooks/`
- Types en `web/types/`
- Utils en `web/lib/`

## Roles y Acceso

```
ADMIN (role=ADMIN)
- Ver todo
- Crear/editar cursos
- Gestionar asesores
- Reportes globales
- Configurar sistema

VENDEDOR (role=VENDEDOR)
- Crear estudiantes
- Registrar pagos
- Ver mis estadísticas
- Enviar recordatorios

MARKETING / EDITOR / COMMUNITY
- Área de Marketing: Calendario, Entregables, Guiones,
  Panel de Edición (Trello) y Redes (programar publicaciones IG/FB)
- Configurar la App de Meta y desvincular cuentas: solo ADMIN

ESTUDIANTE (role=ESTUDIANTE)
- Módulo Brito (estudio)
```

## Área de Marketing (agosto 2026)

Vive en `web/src/app/marketing/` (tabs en `web/src/lib/marketingNav.ts`; roles ADMIN/MARKETING/EDITOR/COMMUNITY). Además de Calendario, Entregables y Guiones:

- **Panel de Edición** (`marketing/panel-edicion`): videos aprobados y en corrección por editor, en vivo desde Trello. Los datos vienen de una Netlify Function externa (`panel.grupo500educacion.co/api/stats`) consumida vía el proxy interno `web/src/app/api/marketing/panel-edicion/route.ts` — la CSP de la app no deja al navegador llamar dominios externos. Las reglas de conteo de los tableros de Trello están en la Sesión 034 del historial.
- **Redes** (`marketing/redes`): vincular páginas de Facebook e Instagram profesionales (OAuth de Meta con `config_id` de Facebook Login for Business — los scopes sueltos dan "Invalid Scopes") y programar posts/historias/reels. Backend en `api/src/{routes,controllers}/redes*` + `services/metaGraph.service.ts`; el job `jobs/publicarRedes.ts` publica cada minuto. Credenciales de la App de Meta en la tabla `ConfigApp` (claves `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`), editables desde la propia pantalla (solo ADMIN). Media en Cloudinary vía `/api/upload/*`; IG exige JPEG/MP4 y la URL se transforma sola.

Detalle completo y decisiones: `docs/SESIONES/historial.md`, Sesión 034.

## Información de Contacto

- **Responsable:** David Jaimes — pregrupo500@gmail.com (cuenta dueña de GitHub, Railway, Vercel, Netlify y la App de Meta)
- NexCode97 (hodmanj59@gmail.com) desarrolló las fases iniciales y **ya no participa** en el proyecto (desde ago-2026)

## Links Útiles

- [Plan de Estructuración](../.claude/plans/snazzy-nibbling-puffin.md)
- [Historial de Sesiones](docs/SESIONES/historial.md)
- [API Documentation](docs/API.md)

## Notas Importantes

1. **Backend primero:** Todas las APIs deben estar 100% funcionales antes de tocar UI
2. **WhatsApp:** Primero como stub (log), integración real Twilio después
3. **Commit & Push:** Hacer commit y push al terminar cada tarea sin pedir confirmación
4. **Historial:** Actualizar `docs/SESIONES/historial.md` al finalizar cada sesión

## Sesiones Anteriores

Ver `docs/SESIONES/historial.md` para contexto de trabajo anterior.
