# PRD adaptado — Área de simulacros tipo ICFES

> Adaptación del "PRD — Plataforma de Simulacros Grupo 500" (v0.1, borrador del cliente) a la
> plataforma existente (`grupo500educacion.co`, este monorepo). El PRD original proponía construir
> una app nueva desde cero con NestJS; **aquí no se parte de cero**: el repo ya tiene un motor de
> exámenes funcionando (`/examenes`, tablas `sim_*`) que cubre buena parte del alcance. Este
> documento fija qué ya existe, qué falta, cómo se integra y qué decisiones quedan por confirmar.

**Versión:** 1.0 · **Fecha:** 2026-08-10 · **Fuente:** PRD v0.1 del cliente + auditoría del repo

---

## 1. Resumen

Área independiente dentro de la plataforma para que estudiantes de colegios aliados presenten
simulacros Saber 11 cronometrados, se califiquen automáticamente, revisen correcciones en video
pregunta por pregunta, y para que cada colegio aliado reciba un informe consolidado automático.

Cada **producto** es un simulacro completo (ej. "Simulacro N.° 4 — Calendario A 2026") con cinco
piezas: preguntas y opciones, hoja de respuestas, calificador, correcciones en video e informe del
colegio. El acceso de cada estudiante se habilita **por producto** (accesos diferenciados).

## 2. Punto de partida — lo que el repo ya tiene

| Pieza del PRD | Estado en el repo | Dónde |
|---|---|---|
| Login de estudiante | ✅ Correo + documento (hash SHA-256), rol `ESTUDIANTE` vía Auth.js credentials | `web/src/auth.ts` |
| Producto/simulacro | ✅ `Examen` (`sim_simulacros`): título, activo, ventana `abreAt`/`cierraAt`, `duracionMin` | `api/prisma/schema.prisma` |
| Banco de preguntas | ✅ `PreguntaExamen` (`sim_preguntas`): sesión, área, orden, contexto, enunciado, opciones A–H, correcta, explicación, `retroOpciones`, imagen | schema + admin |
| Dos sesiones + cronómetro | ✅ `IntentoExamen` (`sim_intentos`): respuestas JSON por sesión, cronómetro **autoritativo del servidor** con pausa/reanudación (`sesionNConsumidoSeg`), autosave | `web/src/app/examenes/[id]/acciones.ts` |
| Hoja de respuestas única | ✅ Internamente un solo intento con `s1`/`s2`; enviar S1 bloquea y avanza a S2 | ídem |
| Calificador | ✅ 0–100 por área + global 0–500 con pesos 3/3/3/3/1 — **matemáticamente idéntico** a la fórmula del PRD `[(M×3)+(L×3)+(S×3)+(C×3)+(I)]/13×5` | `web/src/lib/calificacion.ts` |
| Retroalimentación | 🟡 Texto por pregunta (`explicacion`, `retroOpciones`); **no hay video** | `/examenes/[id]/resultado` |
| Admin de contenido | ✅ Editar preguntas, subir imágenes (Cloudinary), preview fiel | `web/src/app/examenes/admin/` |
| Colegios | ✅ Modelo `Colegio`; `EstudianteExamen.colegioId` ya relaciona | schema |
| Correo saliente | 🔴 Stub sin implementar | `certificados.controller.ts` |

**Conclusión de arquitectura:** no se crea una app nueva ni se cambia el stack. El área de
simulacros del PRD **es la evolución del motor `sim_*` existente**. El stack recomendado del PRD
original (NestJS, bucket S3, etc.) queda reemplazado por el stack real del repo: Next 15 (Vercel) +
Express (Railway) + Prisma/Neon + Auth.js + Cloudinary.

## 3. Brechas — lo que hay que construir

### 3.1 Accesos diferenciados por producto (prioridad 1)

Hoy todo estudiante con sesión ve todos los exámenes activos. El PRD exige habilitar productos
distintos a estudiantes distintos.

- Nueva tabla `AccesoExamen` (`sim_accesos`): `estudianteId × examenId`, único, con `habilitadoAt`
  y `retiradoAt` (retirar = ocultar sin borrar histórico, §6.2 del PRD).
- El listado `/examenes` del estudiante filtra por sus accesos y muestra el **estado** de cada
  producto: pendiente · en curso · calificado · con correcciones (estado derivado del intento, no
  se almacena).
- Admin/asesor no cambian: siguen viendo todo.

### 3.2 Carga masiva por CSV (prioridad 1)

Pantalla en `/examenes/admin`: subir CSV con columnas `nombre, tipo_identificacion, documento,
correo, colegio, ids_productos` (IDs internos separados por `;`).

- Valida correos, IDs de producto existentes y duplicados; **reporta filas con error sin abortar
  la carga completa** (mismo patrón del validador de CSV usado en otras cargas del repo).
- Crea/actualiza `EstudianteExamen` (documento → `documentoHash`, nunca en claro — regla ya
  vigente) y crea los `AccesoExamen`.
- El **ID interno del producto** es la clave de cruce en todo (accesos, CSV, preguntas, correctas,
  videos, resultados) — ya es así: `Examen.id` es explícito (1, 2, 3…), no autoincrement.

### 3.3 Correcciones en video por pregunta (prioridad 2)

- Campo nuevo `videoUrl` en `PreguntaExamen` (relación 1–1 pregunta↔video del PRD; no amerita
  tabla aparte).
- Vista de corrección: video arriba, opciones abajo marcando la respuesta que eligió el
  estudiante (la data ya está en `IntentoExamen.respuestas`).
- Solo visible para productos cuyo ciclo llegó a calificación (regla del PRD, ya derivable).
- **Hosting:** los videos hoy están en Google Drive. Recomendación: migrarlos a
  **Cloudinary con delivery autenticado y URLs firmadas de corta duración** (ya es dependencia del
  repo, cumple el requisito de "baja vulnerabilidad" del §11.3). Alternativa más barata si el
  volumen crece (≈244 videos por producto): Bunny Stream. Decisión de costo pendiente.

### 3.4 Ajuste en cascada de la calificación — ✅ hecho (2026-08-10)

El cliente confirmó la regla exacta ("Algoritmo de calificación — Plataforma de Simulacros"):
es una **cascada de dos pasos** sobre el puntaje base por materia, no la tabla por tramos del
borrador. base 100 → 100; base 11–99 → −10, y si el resultado cae en 85–89 → −4 adicional;
base 0–10 → sin cambio. Efecto neto: 95–99 → −14, 11–94 → −10. Global = promedio ponderado
(3/3/3/3/1, denominador 13) de las materias **ya ajustadas** × 5.

Implementado en `ajustarPuntajeMateria()` (`web/src/lib/calificacion.ts`), aplicado en
`calificar()` y en la página de resultado (que ahora usa la lib compartida). Verificado contra
los 10 ejemplos y el global 405 del documento. Los intentos ya finalizados se **recalcularon**
con la regla nueva para que resultados, promedios y el futuro informe por colegio sean
consistentes (el recálculo es determinista desde las respuestas guardadas: reversible).

### 3.5 Informe automático por colegio (prioridad 2)

- Disparador: al finalizar cada intento se verifica si **todos** los estudiantes con acceso al
  producto en ese colegio ya finalizaron → se genera el informe (job en `api/src/jobs/`, mismo
  patrón de `sincronizarAtrasos`).
- Contenido: estadística descriptiva, campana de Gauss, dispersión por áreas, salto de página,
  tabla de estudiantes. Formato: membrete "Grupo 500" + marca de agua "Logos" — se reutiliza el
  diseño del informe institucional existente (anexo C del PRD; pedir los archivos fuente).
- Render a PDF: pieza nueva en el API (el repo solo tiene `pdf2json`, que es lector). Recomendado
  `@react-pdf/renderer` en el API o Puppeteer en Railway.
- Envío: al correo de aliados. **Requiere implementar el servicio de correo saliente** (hoy es un
  stub). Recomendado Resend o SMTP de Google Workspace. Este servicio lo necesita también el OTP
  si se aprueba (§5.1).

### 3.6 Experiencia de examen — ajustes al motor actual

- **Cronómetro 4h30 por sesión** con tiempo agotado en **rojo y conteo negativo** (no corta el
  examen; registra el tiempo extra). Verificar el comportamiento actual de `duracionMin` y pasar a
  duración **por sesión** si el cliente confirma que pueden diferir.
- **Subrayado** de textos largos (rango de selección persistido en el intento, por estudiante).
- **Navegación libre** ya existe; mantener (p. ej. empezar en la 26).
- **Fidelidad visual al PDF fuente** (§8 del PRD): imágenes en escala de grises sin alterar
  proporción (pipeline con ffmpeg al digitalizar), negrilla obligatoria en los encabezados de
  lectura crítica ("las preguntas X–Y se responden con…"), referencias bibliográficas
  conservadas, ortografía y tildes intactas. El componente `TextoExamen` ya renderiza contexto +
  enunciado; se ajusta contra los PDF "S4 Primera/Segunda Sesión".
- **Tipos de respuesta**: Tipo 3 (a–d, todas las materias) y Tipos 1–2 (a–g / a–c, solo inglés)
  — el schema ya soporta hasta 8 opciones; solo cuidar el render por cantidad de opciones.

### 3.7 Protocolo de alta y baja de producto

Ya casi todo existe; se formaliza como checklist del admin:

1. Crear examen con ID interno único + nombre visible.
2. Cargar preguntas por materia/sesión (digitalización desde los 2 PDF — proceso asistido
   nuestro, la automatización total queda fuera de alcance como dice el PRD).
3. Cargar respuestas correctas (campo `correcta` por pregunta).
4. Cargar videos de corrección.
5. Habilitar accesos por CSV y activar (`activo: true`).

Baja: `activo: false` + marcar `retiradoAt` en los accesos. Los resultados históricos se
conservan (regla del PRD).

## 4. Cambios al schema (resumen)

```prisma
model AccesoExamen {
  id           String    @id @default(cuid())
  estudianteId String    @db.Uuid
  examenId     Int
  habilitadoAt DateTime  @default(now())
  retiradoAt   DateTime?
  @@unique([estudianteId, examenId])
  @@map("sim_accesos")
}
// PreguntaExamen: + videoUrl String?
// Examen: + duracionS1Min/duracionS2Min (si se confirma), + ajusteTramos Boolean @default(false)
// InformeColegio (sim_informes): colegioId × examenId, pdfUrl, enviadoAt, destinatario
```

## 5. Decisiones a confirmar con el cliente

1. **OTP vs. documento.** ✅ **Resuelto (2026-08-10): se mantiene correo + documento.** El PRD
   pedía OTP; la autenticación existente ya está probada en producción y no depende de la
   entrega de correos. OTP queda como opción futura si el cliente lo exige.
2. **Tabla exacta del ajuste por tramos** — ✅ **Resuelto (2026-08-10):** el cliente entregó el
   algoritmo en cascada; implementado, ver §3.4.
3. **Hosting de videos**: Cloudinary firmado (integrado, más caro en volumen) vs. Bunny Stream.
4. **¿La sesión 2 puede presentarse otro día** o debe ser continua? (El motor actual lo permite;
   definir si hay que restringirlo.)
5. Concurrencia pico esperada (dimensionar Railway/Neon).
6. Archivos fuente del informe institucional (membrete, "Logos", plantilla estadística).
7. Política de reintentos/incidencias durante el examen (hoy: 1 intento por estudiante-examen).

## 6. Fases propuestas

| Fase | Contenido | Depende de |
|---|---|---|
| 1 | ✅ **Hecha (2026-08-10).** Accesos diferenciados + estados en el listado + carga CSV | — |
| 2 | ✅ **Hecha (2026-08-10).** Cronómetro negativo, subrayado, y auditoría de fidelidad del Simulacro 2 contra sus PDFs fuente (4 correcciones de datos aplicadas) | — |
| 3 | Correcciones en video (campo, vista, migración de videos a hosting firmado) | decisión §5.3 |
| 4 | Servicio de correo + informe por colegio (PDF + envío automático) | anexos §5.6 |
| 5 | Ajuste por tramos del calificador (+ OTP si se aprueba) | confirmaciones §5.1–5.2 |
| 6 | Alta del producto S4 real (digitalización de 244 preguntas + correctas + videos) y piloto | fases 1–4 |

## 7. Criterios de aceptación (heredados del PRD, mapeados)

- CSV crea accesos correctos por ID de producto; filas inválidas se reportan sin abortar.
- El render coincide visualmente con el PDF fuente (texto, fórmulas, imágenes en gris,
  negrillas de lectura crítica).
- A 0:00 el cronómetro continúa en rojo negativo; el tiempo es autoritativo del servidor. ✅ (la
  parte servidor ya existe)
- Navegación en cualquier orden; tras caída se recupera estado y reloj. ✅ ya existe
- Enviar S1 la bloquea; no responder = errada; internamente una sola hoja. ✅ ya existe
- Puntaje por materia y global según fórmulas; pantalla de calificación. ✅ (falta solo tramos)
- Video por pregunta + respuesta inicial del usuario; solo productos con ciclo completo.
- Informe del colegio se genera al completar todo el colegio y se envía a aliados, con membrete,
  marca de agua, Gauss, dispersión y salto de página.
