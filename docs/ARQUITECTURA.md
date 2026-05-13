# Arquitectura de Grupo 500

## Visión General

Grupo 500 es una plataforma monorepo con frontend (Next.js) y backend (Express) separados. Usa PostgreSQL con Prisma ORM y autenticación Clerk.

```
Cliente (Browser)
     ↓
  Next.js (Vercel)
     ↓
  Express API (Railway)
     ↓
  PostgreSQL (Neon)
```

## Stack

### Frontend
- **Next.js 15** App Router
- **TypeScript**
- **Tailwind + shadcn/ui** para UI
- **TanStack Query** para estado servidor
- **Clerk** para autenticación
- **Recharts** para gráficas
- **jsPDF** para generación de certificados
- **Cloudinary SDK** para assets

### Backend
- **Express.js** con TypeScript
- **Prisma ORM** para BD
- **Clerk Backend SDK** para validar tokens
- **Zod** para validación de inputs
- **Bull Queue** para colas asíncronas
- **Multer** para uploads

### Infraestructura
- **PostgreSQL** en Neon
- **Cloudinary** para almacenamiento (PDFs, certificados, comprobantes)
- **Railway** para backend
- **Vercel** para frontend
- **GitHub Actions** para CI/CD

## Base de Datos (Prisma Schema)

### Entidades Principales

```
User (autenticación Clerk)
├── Asesor (vendedor)
├── Estudiante
│   ├── Acudiente
│   ├── CursoEstudiante → Curso
│   ├── Pago → Asesor
│   ├── Financiamiento → Cuota[]
│   ├── SimulacroEstudiante → Simulacro
│   └── Certificado
├── Colegio
└── Simulacro
```

### Relaciones Clave

- **User → Asesor (1:1):** Admin y Vendedores
- **Estudiante → Acudiente (1:1):** Datos de quien paga
- **Estudiante → Colegio (M:1):** Base de colegios
- **Estudiante → CursoEstudiante → Curso (M:M):** Cursos comprados
- **Estudiante → Pago (1:M):** Historial de pagos
- **Estudiante → Financiamiento → Cuota (1:M:M):** Cuotas activas
- **Estudiante → SimulacroEstudiante → Simulacro (M:M):** Resultados

## API Design

### Convenciones

- RESTful endpoints
- Bearer token de Clerk en headers
- Validación con Zod
- Response uniforme: `{ success: boolean, data?: T, error?: string }`
- Paginación: `?page=1&limit=10`
- Filtros: `?colegioId=X&estado=PAGADO`

### Rutas Principales

```
/api/
├── auth/
│   ├── me                    # Datos del usuario actual
│   └── logout
├── estudiantes/
│   ├── GET (listar)
│   ├── POST (crear)
│   ├── :id GET, PATCH, DELETE
│   └── :id/rendimiento
├── asesores/
│   ├── GET (listar)
│   ├── :id/estadisticas
├── pagos/
│   ├── GET (listar con filtros)
│   ├── POST (registrar pago)
│   ├── :id PATCH (cambiar estado)
├── financiamientos/
│   ├── POST (crear)
│   ├── :id GET
├── cuotas/
│   ├── :id PATCH (marcar pagado)
├── certificados/
│   ├── POST (generar)
│   ├── :id GET (descargar PDF)
├── simulacros/
│   ├── POST (upload)
│   ├── :id/analizar
├── cobros/
│   ├── /calendario (por fecha)
│   ├── /recordatorios (crear/ver)
├── whatsapp/
│   ├── /enviar (stub por ahora)
│   ├── /historial
└── reportes/
    ├── /dashboard-admin
    ├── /ingresos
    ├── /asesores
```

## Flujos Principales

### 1. Compra de Curso

```
Admin/Asesor crea Estudiante
    ↓
Admin/Asesor asigna Curso
    ↓ (Trigger)
Sistema genera Certificado "CURSANDO"
    ↓
Si hay financiamiento → Crear cuotas automáticas
```

### 2. Registro de Pago

```
Asesor/Admin registra Pago
    ↓
Sistema valida monto y estudiante
    ↓
Si es cuota → Marcar Cuota.pagado = true
    ↓
Crear ReminderCobro si hay siguiente cuota
```

### 3. Análisis de Simulacro

```
Admin/Asesor sube PDF
    ↓ (Async Job)
Sistema parsea PDF
    ↓
Extrae estudiantes y puntajes
    ↓
Analiza áreas débiles
    ↓
Crea SimulacroEstudiante records
    ↓
Si rendimiento bajo → Flag requiereIntensivo
```

### 4. Recordatorio de Cobro

```
Admin/Asesor abre Calendario
    ↓
Filtra cuotas vencidas para hoy
    ↓
Click "Enviar WhatsApp"
    ↓ (Stub → Log)
Sistema registra el envío
    ↓ (Futuro: Integrar Twilio)
Envía mensaje real
```

## Seguridad

- **Autenticación:** Clerk (OAuth Google)
- **Autorización:** Validar role en cada endpoint
- **Validación:** Zod schemas
- **CORS:** Permitir solo dominio frontend
- **Rate Limiting:** Implementar si es necesario
- **Datos sensibles:** Encriptar comprobantes en Cloudinary

## Performance

- **Caching:** TanStack Query en frontend
- **Paginación:** Siempre en listados grandes
- **Índices DB:** En `estudiante.email`, `pago.fechaVencimiento`, etc.
- **Lazy Loading:** Componentes grandes en frontend
- **CDN:** Cloudinary para assets

## Deployment

- **Frontend:** Vercel (push a main → auto deploy)
- **Backend:** Railway (push a main → auto deploy)
- **DB:** Neon (conexión segura)
- **Env Vars:** Configurar en Vercel y Railway

## Testing

- **Unit:** Servicios backend (Jest)
- **Integration:** APIs con BD de test
- **E2E:** Critical flows (Playwright)
- **Manual:** Postman collection

## Futuro

- [ ] Twilio WhatsApp (reemplazar stub)
- [ ] PDF parsing inteligente (OCR/AI)
- [ ] Sistema de comisiones automático
- [ ] Reportes programados
- [ ] Mobile app (React Native)
