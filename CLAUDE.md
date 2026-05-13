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

## Stack Tecnológico

### Frontend (Next.js)
- **Framework:** Next.js 15 + App Router
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS v4 + shadcn/ui
- **Auth:** Clerk (@clerk/nextjs)
- **Datos:** TanStack Query
- **Gráficas:** Recharts
- **PDFs:** jsPDF, react-pdf
- **Almacenamiento:** Cloudinary
- **Deploy:** Vercel

### Backend (Express)
- **Framework:** Express.js 4 + TypeScript
- **ORM:** Prisma
- **Auth:** Clerk Backend SDK
- **DB:** PostgreSQL (Neon)
- **Colas:** Bull Queue
- **Integraciones:** Twilio (WhatsApp), SendGrid (emails)
- **Deploy:** Railway

### Infraestructura
- Monorepo con `pnpm workspaces`
- PostgreSQL en Neon
- Cloudinary para assets
- Railway para backend
- Vercel para frontend

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
```

## Información de Contacto

- **Usuario:** hodmanj59@gmail.com
- **Empresa:** NexCode97
- **WhatsApp:** +57 316 413 4212

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
