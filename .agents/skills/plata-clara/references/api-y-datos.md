# API, datos, seguridad y rendimiento

## Modelo de datos (SQLite)

Ruta en producción: `/opt/plata-clara/server/data/plata-clara.db`
Esquema y migraciones: `server/src/db.js`

```
usuarios          id, nombre, email, clerk_id, tipo_ocupacion, frecuencia,
                  bruto_mensual, meta_principal, presupuesto_variable,
                  onboarding_completo, premium_hasta, creado_en
gastos_fijos      id, usuario_id, nombre, monto, dia_pago, activo
deudas            id, usuario_id, nombre, tipo, saldo, cuota, tasa_ea, dia_pago, activa
gastos            id, usuario_id, categoria, monto, metodo, fecha, nota, es_hormiga, gmf
metas             id, usuario_id, tipo, nombre, monto_objetivo, monto_actual,
                  fecha_objetivo, activa
parametros        clave, valor, anio, descripcion      ← parámetros Colombia
eventos_pago      id, usuario_id, email, evento, datos, creado_en   ← auditoría webhook
sesiones          (residual de la auth vieja, sin uso)
```

Índices en toda consulta caliente: `(usuario_id, fecha)`, `(usuario_id, categoria)`,
`(usuario_id, activo/activa)`, `clerk_id` único. WAL activado.

**Inspeccionar la DB en producción:**
```bash
ssh -i "$PC_SSH_KEY" "$PC_VPS" \
 'sqlite3 /opt/plata-clara/server/data/plata-clara.db "SELECT id,email,creado_en FROM usuarios;"'
```

---

## Endpoints

Todos bajo sesión Clerk salvo el webhook.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/me` | usuario + categorías + métodos + parámetros + plan |
| PUT | `/api/perfil` | guarda onboarding (ingreso, frecuencia, tipo, meta) |
| GET/POST/PUT/DELETE | `/api/fijos[/:id]` | gastos fijos |
| GET/POST/PUT/DELETE | `/api/deudas[/:id]` | deudas |
| POST | `/api/deudas/:id/abono` | abona a capital |
| GET/POST/DELETE | `/api/gastos[/:id]` | gastos variables (mes actual) |
| GET/POST/DELETE | `/api/metas[/:id]` | metas (DELETE = soft, `activa=0`) |
| POST | `/api/metas/:id/aporte` | suma a `monto_actual` |
| GET | `/api/diagnostico` | ⭐ **el cálculo completo** (cacheado + ETag) |
| GET | `/api/proyeccion` | escenarios de ahorro 3/6/12/24/60 meses |
| GET | `/api/export.csv` | exportación |
| POST | `/api/webhooks/hotmart` | pagos (valida header `x-hotmart-hottok`) |

**Mutaciones exigen header `X-Requested-With: PlataClara`** (defensa CSRF) — ya lo pone
`client/src/api.ts` automáticamente.

### Agregar un endpoint

En `index.js`, dentro del `app.register(async (priv) => {...})` (ese bloque ya exige sesión):

- validar el body con **Zod**
- usar `req.usuario.id` **siempre** en el WHERE
- si escribe, llamar `cache.invalidarUsuario(req.usuario.id)`

---

## Seguridad (no romper esto)

Helmet con CSP estricta (incluye dominios de Clerk y Cloudflare Turnstile), HSTS, rate-limit
global 300/min, validación Zod en todo input, prepared statements, cookies httpOnly
SameSite=Strict, bodyLimit 64 KB, systemd endurecido, UFW.

## Rendimiento

SQLite WAL + índices; caché LRU (5.000 entradas, TTL 60 s) del diagnóstico con
**invalidación por usuario en cada escritura**; ETag → 304; `Cache-Control: private, no-cache`
(nunca mostrar saldos viejos); assets con hash `immutable, max-age=1año`.
Bundle ~111 KB gzip.

---

## Autenticación (Clerk)

- App Clerk "Plata Clara", cuenta `pregrupo500@gmail.com`
- **Instancia de DESARROLLO** (`*.clerk.accounts.dev`) — por eso aparece el banner naranja
  "Development mode". Funciona perfecto, solo tiene límites de volumen.
- Llaves: `client/.env.local` (local) y `/etc/plata-clara.env` (VPS)
- Frontend: `@clerk/react` + `@clerk/localizations` (esES) + `@clerk/themes` (dark)
- Backend: `@clerk/fastify` (`clerkPlugin` + `getAuth`)
- Los usuarios locales se vinculan por columna **`usuarios.clerk_id`** (find-or-create con el
  perfil de Clerk; si el email ya existía, lo vincula en vez de duplicar)

Para probar autenticado, ver `gotchas-y-qa.md` §QA — **no uses el formulario de registro**.
