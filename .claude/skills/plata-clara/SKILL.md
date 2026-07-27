---
name: plata-clara
description: Contexto operativo completo de Plata Clara (plataclara.co), la app de finanzas personales para Colombia — Fastify + React + SQLite en VPS propio. Úsala cuando la orden mencione Plata Clara, plataclara.co, o pida agregar/cambiar/desplegar/depurar algo en esa app (gastos, deudas, metas, diagnóstico, onboarding, paywall, Nocturne). NO es para Grupo 500 / ICFES, que es otro proyecto en este mismo repo.
---

# Plata Clara

App web (móvil-primero + tablero de escritorio) donde una persona en Colombia registra cuánto
gana y la app organiza su vida financiera: ingresos, gastos variables, gastos fijos, deudas,
presupuesto, metas y proyección de ahorro.

**Diferencial:** está construida sobre la realidad colombiana — quincenas, prima, cesantías,
descuentos de salud y pensión, 4×1000, tasa de usura, categorías locales (Nequi, Daviplata,
D1, EPS, administración).

**Promesa al usuario:** en menos de 5 minutos sabe cuánto le queda libre cada mes, cuándo
termina de pagar sus deudas y cuánto tendrá ahorrado.

**Estado:** MVP completo, en producción, gratuita (monetización construida pero pausada).

| | |
|---|---|
| Producción | `https://plataclara.co` (301 desde `www.` y `plataclara.davidmarketer.com`) |
| Código | `C:\Users\ofici\plata-clara` — git local + espejo en el VPS, **sin GitHub** |
| Cliente | Propio / David Jaimes |
| Stack | Fastify 5 · better-sqlite3 · Zod · React 19 · Vite 6 · TypeScript · Clerk · Caddy |

> ⚠️ **Este repositorio (Grupo-500) es público y NO contiene el código de Plata Clara.**
> Esta skill es solo memoria operativa. Nunca escribas aquí llaves, contraseñas, IPs de
> producción ni tokens. Ver "Credenciales" abajo.

---

## Las 4 reglas que no se rompen

1. **Dinero = enteros en pesos COP.** Nunca `float`, nunca decimales. Salida siempre `es-CO`:
   `$ 1.850.000`. Usar `fmt()` de `client/src/format.ts`.
2. **Todo endpoint que escribe llama `cache.invalidarUsuario(req.usuario.id)`.** Si no, el
   usuario ve saldos viejos hasta 60 s.
3. **Todo query filtra por `req.usuario.id` en el WHERE.** Sin excepción.
4. **La app nunca regaña.** Informa y propone. Nada de "otra vez te pasaste". Ver
   `references/diseno-y-copy.md`.

---

## Cómo ejecutar una orden de punta a punta

Cuando llegue *"agrega X"* o *"cambia Y"*:

1. **Ubicar.** Usa el mapa de archivos de abajo. Si es copy, `Grep` la frase en
   `client/src/pantallas/`. Si es un número del diagnóstico, está en
   `server/src/finanzas.js` o en `computarDiagnostico()` de `server/src/index.js`.
2. **Editar.** Respeta las 4 reglas. Para archivos grandes, script Python con
   `assert count == 1` por reemplazo (gotcha #8).
3. **Probar local.** `npm run dev` (Vite :5173 con proxy al API :8787).
   Para QA autenticado usa **sign-in tokens de Clerk**, nunca el formulario de registro —
   ver `references/gotchas-y-qa.md` §QA. Esto es lo que más tiempo ahorra.
4. **Desplegar.** Receta exacta de copiar/pegar en `references/despliegue.md`. Debe terminar
   en `DEPLOY_OK`.
5. **Verificar en producción** y reportar qué cambió.

### Recetas rápidas

**Agregar un campo al diagnóstico**
1. `server/src/index.js` → `computarDiagnostico()`: agregar la clave al objeto de retorno
2. `client/src/api.ts` → agregarla a la interfaz `Diagnostico`
3. Usarla en la pantalla
4. Desplegar

**Agregar un endpoint**
Dentro del `app.register(async (priv) => {...})` de `index.js` (ese bloque ya exige sesión).
Validar el body con Zod, usar `req.usuario.id` siempre en el WHERE, y llamar
`cache.invalidarUsuario()` si escribe.

**Cambiar un texto:** `Grep` la frase en `client/src/pantallas/` y editarla respetando el tono.

**Revertir un despliegue:** en el VPS existe `/opt/plata-clara.old` con la versión anterior.

---

## Mapa del código

Monorepo con **npm workspaces**. Sin Docker, sin build complicado.

```
plata-clara/
├── package.json          # workspaces: server, client
├── server/               # API + hosting del SPA (Fastify, ESM, todo async)
│   ├── src/
│   │   ├── index.js      # rutas, seguridad, webhook de pagos, computarDiagnostico()
│   │   ├── db.js         # esquema SQLite, migraciones, parámetros Colombia
│   │   ├── finanzas.js   # motor de cálculo PURO (sin I/O) — neto, deudas, score, VF
│   │   ├── auth.js       # ⚠️ MUERTO (reemplazado por Clerk) — se puede borrar
│   │   └── cache.js      # LRU en memoria + ETag
│   └── data/             # plata-clara.db (NO versionado, NO se sube en deploy)
└── client/               # React 19 + Vite + TypeScript
    ├── public/           # logo.png, icon-*.png, manifest.json, sw.js
    └── src/
        ├── main.tsx      # ClerkProvider (es-ES + apariencia Nocturne)
        ├── App.tsx       # router por estado + historial (gesto atrás)
        ├── api.ts        # cliente HTTP + tipos del API
        ├── format.ts     # fmt(), fmtPriv(), soloDigitos(), cap1()
        ├── instalar.ts   # hook de instalación PWA
        ├── theme.css     # tokens Nocturne + clases (glass, chips, animaciones)
        └── pantallas/
            ├── Auth.tsx        # login/registro Clerk + escena animada
            ├── Onboarding.tsx  # 5 pasos
            ├── Diagnostico.tsx # resultado inicial
            ├── Tablero.tsx     # ⭐ dashboard móvil (wallet) + escritorio (sidebar)
            ├── NuevoGasto.tsx  # teclado + detalle (3 toques)
            ├── NuevaMeta.tsx   # crear meta con proyección
            ├── Movimientos.tsx # lista del mes + CSV
            ├── Deudas.tsx      # avalancha vs bola de nieve + abonos
            └── Paywall.tsx     # suscripción (hoy inactivo)
```

---

## Referencias

Cárgalas según lo que pida la orden:

| Archivo | Cuándo leerlo |
|---|---|
| `references/despliegue.md` | Desplegar, entrar al VPS, ver logs, revertir, infraestructura, credenciales |
| `references/finanzas.md` | Tocar cualquier cálculo, fórmula o parámetro colombiano |
| `references/api-y-datos.md` | Agregar/cambiar endpoints, esquema SQLite, caché, CSRF |
| `references/diseno-y-copy.md` | UI, colores, tipografía, tono de los textos |
| `references/gotchas-y-qa.md` | **Antes de probar cualquier cosa** y ante cualquier síntoma raro |

---

## Credenciales — cómo resolverlas en tiempo de ejecución

Nada de esto vive en este repositorio público. Los valores reales están en la máquina del
usuario:

| Qué | Dónde |
|---|---|
| Llaves Clerk (`pk_`/`sk_`) | `plata-clara/client/.env.local` (local) · `/etc/plata-clara.env` (VPS) |
| Llave SSH del VPS | `C:\Users\ofici\.ssh\plataclara_ed25519` |
| Host/IP del VPS, API key Hostinger | `OneDrive\Documentos\skil credenciales\RUNBOOK-GRUPO500-WEB.md` |
| Credenciales del ecosistema | `C:\Users\ofici\CREDENCIALES-API.md` |
| Postgres y Redis del VPS | `/root/SERVICIOS-CREDENCIALES.txt` en el VPS (chmod 600) |

Los comandos de `references/despliegue.md` usan `$PC_VPS` y `$PC_SSH_KEY`; exporta esas
variables desde el runbook al inicio de la sesión y no las escribas en ningún archivo
versionado.

---

## Pendientes conocidos

**Producto (fases 2-4 del PRD)**
- Presupuesto por categoría con alertas al 80 % / 100 %
- UI de proyecciones (el endpoint `/api/proyeccion` ya existe, falta pantalla)
- Ingresos extraordinarios: prima (jun/dic) y cesantías (feb) con plan de asignación
- Recordatorios push y racha de registro
- Registro de gasto por voz · Modo pareja/hogar · Conexión bancaria

**Operación**
- Copiar los backups **fuera** del VPS (hoy quedan en el mismo disco)
- Borrar usuarios de prueba antes de invitar gente real
- Pasar Clerk a instancia de **producción** sobre plataclara.co (quita el banner naranja;
  requiere CNAMEs + credenciales propias de Google OAuth + rotar a `pk_live`/`sk_live`).
  La Platform API no está habilitada para esta cuenta → hay que hacerlo desde
  dashboard.clerk.com
- APK Android: TWA (PWABuilder/Bubblewrap) + `assetlinks.json` + Play Console ($25 USD única
  vez) + política de privacidad (Ley 1581 Habeas Data)
- iOS App Store: Apple Developer ($99/año) + wrapper Capacitor + Mac
