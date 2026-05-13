# Grupo 500 - Plataforma de Cursos Pre-ICFES

Plataforma SaaS para gestión y venta de cursos virtuales de preparación para el ICFES.

## Características

- 📚 Gestión de estudiantes, cursos y acudientes
- 💰 Sistema de pagos y financiamientos (cuotas)
- 📅 Calendario de cobros con WhatsApp
- 📜 Generación de certificados
- 📊 Análisis de simulacros (PDFs)
- 📈 Reportes avanzados y estadísticas
- 👥 Roles: Admin y Vendedor

## Stack

**Frontend:** Next.js 15 · TypeScript · Tailwind · shadcn/ui · Clerk  
**Backend:** Express · Prisma · PostgreSQL · Bull Queue  
**Deploy:** Vercel (frontend) · Railway (backend) · Neon (DB)

## Quick Start

```bash
# Instalar dependencias
pnpm install

# Setup base de datos
cd api && npx prisma migrate dev

# Arrancar desarrollo
# Terminal 1: cd api && pnpm dev
# Terminal 2: cd web && pnpm dev
```

## Documentación

- [CLAUDE.md](CLAUDE.md) - Guía de desarrollo
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) - Arquitectura
- [docs/API.md](docs/API.md) - Endpoints

## Fases

1. **Backend (Sem. 1-2):** APIs CRUD, auth, validaciones
2. **Frontend (Sem. 3-4):** Dashboards, UI
3. **Deploy (Sem. 5):** Testing y deploy

## Contacto

- **Email:** nexcode97@gmail.com
- **WhatsApp:** +57 316 413 4212
