# Despliegue e infraestructura

## Variables de sesión

Los comandos de este documento asumen que exportaste, desde el runbook local
(`OneDrive\Documentos\skil credenciales\RUNBOOK-GRUPO500-WEB.md`):

```bash
export PC_SSH_KEY=/c/Users/ofici/.ssh/plataclara_ed25519
export PC_VPS=root@<IP-del-VPS>          # ver runbook
```

Nunca pegues el valor real de `$PC_VPS` en un archivo versionado.

---

## 1. Desarrollo local

```bash
cd /c/Users/ofici/plata-clara
npm install          # solo la primera vez
npm run dev          # Vite :5173 con proxy al API :8787
```

Levantar solo el servidor con las llaves de Clerk:

```bash
cd /c/Users/ofici/plata-clara/server
export $(grep -o '^[A-Z_]*=[^ ]*' ../client/.env.local | tr '\n' ' ')
export CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
PORT=8788 node src/index.js
```

---

## 2. Desplegar a producción (receta exacta)

```bash
cd /c/Users/ofici/plata-clara/client && npx tsc -b && npx vite build && \
cd /c/Users/ofici/plata-clara && git add -A && git commit -q -m "mensaje del cambio" && \
git push -q vps main && \
tar --exclude='node_modules' --exclude='plata-clara/server/data' --exclude='.git' \
    --exclude='plata-clara/.agents' -czf /tmp/pc.tar.gz -C /c/Users/ofici plata-clara && \
scp -i "$PC_SSH_KEY" -o BatchMode=yes /tmp/pc.tar.gz "$PC_VPS:/root/plata-clara.tar.gz" && \
ssh -i "$PC_SSH_KEY" -o BatchMode=yes "$PC_VPS" 'bash /root/deploy.sh 2>&1 | tail -2'
```

**Debe terminar en `DEPLOY_OK`.** El script del servidor:

1. Extrae el tar en `/opt/plata-clara.new`
2. **Copia la base de datos existente** (los datos nunca se pierden)
3. Hace swap atómico `plata-clara` → `plata-clara.old`
4. `npm install --omit=dev` del server
5. `systemctl restart plata-clara`

**Revertir:** `/opt/plata-clara.old` guarda la versión anterior.

**Ver logs en vivo:**
```bash
ssh -i "$PC_SSH_KEY" "$PC_VPS" 'journalctl -u plata-clara -f'
```

---

## 3. VPS

VPS **Hostinger** de la cuenta **GRUPO500** (`pregrupo500@gmail.com`), no de davidmarketer.

| | |
|---|---|
| VM id | 1854471 · `srv1854471.hstgr.cloud` |
| Plan | KVM 2 — 2 CPU, 8 GB RAM, 100 GB |
| SO | Ubuntu 24.04 (recreado limpio 2026-07-24) |

> ⚠️ En esa cuenta hay **OTRO VPS (id 1776207, Docker+Traefik)** que NO es de este proyecto.
> No tocarlo.

Contraseña root de respaldo (solo sirve por la consola web de Hostinger):
archivo `plataclara_vps_root.txt` junto a la llave SSH.

### Servicios

| Servicio | Detalle |
|---|---|
| `plata-clara` (systemd) | Node 22, usuario sin privilegios, `ProtectSystem=strict`, `MemoryMax=1G`, reinicio automático. Env: `/etc/plata-clara.env` |
| `caddy` | Reverse proxy + HTTPS automático. Config: `/etc/caddy/Caddyfile` |
| `postgresql` (16) | localhost:5432, rol `apps` — **libre, para otros proyectos** |
| `redis-server` | localhost:6379 con password — **libre, para otros proyectos** |
| `ufw` | Solo 22, 80, 443 |
| Backup diario | `/etc/cron.daily/plata-clara-backup` → `/var/backups/plata-clara/` (14 días) |

### DNS

`plataclara.co` registrado en Hostinger Grupo500. Zona en Hostinger:
`@` → A (IP del VPS), `www` → CNAME apex. NS: `nova/cosmos.dns-parking.com`.

---

## 4. Gotchas de despliegue (aprendidos a las malas)

1. **`deploy.sh` NO debe escribir el Caddyfile.** Antes lo sobreescribía con una plantilla de
   un solo dominio y tumbaba el TLS de los demás (alert 80). El Caddyfile se edita **a mano**.
2. **`systemctl enable --now` no reinicia** un servicio ya corriendo → usar `restart`.
   Síntoma: desplegaste y sigue sirviendo el código viejo.
3. Un `openssl s_client` que devuelve `Verify return code: 0` **pero sin línea `subject=`** es
   un **falso positivo**: no entregó certificado.
4. Dominio recién comprado: NXDOMAIN por minutos u horas es normal. Verificar contra el NS
   autoritativo (`Resolve-DnsName ... -Server nova.dns-parking.com`) antes de diagnosticar.

---

## 5. Monetización (construida, PAUSADA)

Decisión de David (2026-07-24): **la app queda gratuita por ahora.**

Implementado y probado: prueba de N días desde el registro → paywall → suscripción
**$3.99 USD/mes** vía **Hotmart** (webhook `POST /api/webhooks/hotmart`, activa 33 días por
ciclo, revierte en refund/chargeback, audita en `eventos_pago`).

**Para reactivar el cobro:**
1. `UPDATE parametros SET valor=30 WHERE clave='dias_prueba';` + reiniciar el servicio
2. Crear el producto de suscripción en Hotmart
3. Poner en `/etc/plata-clara.env`: `CHECKOUT_URL=<link>` y `HOTMART_HOTTOK=<hottok>`
4. Configurar el postback de Hotmart a `https://plataclara.co/api/webhooks/hotmart`
