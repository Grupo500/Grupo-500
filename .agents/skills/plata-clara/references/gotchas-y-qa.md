# Gotchas y QA

Todos aprendidos a las malas. Leerlos ahorra horas.

---

## QA — cómo probar autenticado (CRÍTICO, leer antes de probar)

**NO intentar registrarse por el formulario con Playwright.** Clerk rechaza los correos de
prueba (`+clerk_test@…`) con `422 form_param_format_invalid`, y el captcha bloquea el flujo.

> Durante el desarrollo esto se diagnosticó erróneamente como "rate limit". **No lo es.**
> No pierdas tiempo esperando a que se libere un límite que no existe.

**El método que SÍ funciona** (oficial de Clerk, sin límites, sin captcha, sin correos):

```bash
cd /c/Users/ofici/plata-clara/client
SK=$(grep CLERK_SECRET_KEY .env.local | cut -d= -f2)

# 1. Buscar el usuario de QA existente (ya está creado: qa.plataclara@gmail.com)
curl -s "https://api.clerk.com/v1/users?email_address=qa.plataclara@gmail.com" \
  -H "Authorization: Bearer $SK" \
  | python -c "import json,sys; print(json.load(sys.stdin)[0]['id'])"

# (solo si hiciera falta crear uno nuevo)
# curl -s -X POST "https://api.clerk.com/v1/users" -H "Authorization: Bearer $SK" \
#   -H "Content-Type: application/json" \
#   -d '{"email_address":["qa.plataclara@gmail.com"],"password":"<generar-una>","skip_password_checks":true}'

# 2. Generar un ticket de sesión (dura 1 h, repetible cuantas veces se quiera)
curl -s -X POST "https://api.clerk.com/v1/sign_in_tokens" -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<USER_ID>","expires_in_seconds":3600}' \
  | python -c "import json,sys; print(json.load(sys.stdin)['token'])"
```

```js
// 3. En Playwright: navegar con el ticket → entra directo, sin login
await page.goto('https://plataclara.co/?__clerk_ticket=' + TICKET, {waitUntil: 'load'});
await page.waitForSelector('text=Paso 1 de 5', {timeout: 25000});
```

El flujo de ticket **no necesita la contraseña** del usuario de QA. No la guardes en ningún
archivo versionado.

**Volver a empezar el onboarding del usuario de QA:**
```bash
ssh -i "$PC_SSH_KEY" "$PC_VPS" \
 'sqlite3 /opt/plata-clara/server/data/plata-clara.db "DELETE FROM usuarios WHERE email LIKE \"qa.%\";"'
```

---

## Windows / entorno

1. **Git Bash convierte rutas que empiezan con `/`** → usar `MSYS_NO_PATHCONV=1` (mata
   comandos como `clerk api /platform/...`).
2. **`python` de Windows resuelve `/tmp` distinto a Git Bash** → escribir temporales con ruta
   `C:/...`.
3. **Forzar `PYTHONIOENCODING=utf-8`** o la consola cp1252 revienta con `→` / `©` / emojis.
4. **Para editar archivos grandes:** script Python con `assert count == 1` por reemplazo.
   Siempre.

---

## Frontend

5. **Inputs a menos de 16px → iOS/Android hacen zoom al enfocar.** Todos los `.inp` están a
   16px. No bajarlos.
6. **`transform-style: preserve-3d` en cualquier ancestro de un input desplaza el área
   clickeable** en Chrome. Usar solo `perspective` en el padre.
7. **No poner animaciones flotantes (`.flota`) sobre tarjetas con botones:** mala UX y
   Playwright falla con *"element is not stable"*.
8. **Clerk v6 renombró las variables de apariencia** (`colorText` → `colorForeground`, etc.).
   Hay que poner **ambos nombres** + overrides en `elements` + CSS `!important` sobre
   `.cl-formFieldInput`. Solo `baseTheme: dark` **no basta** (texto ilegible).
9. **El navegador de preview in-app tiene IntersectionObserver y rAF congelados** → verificar
   por `javascript_tool`, no por captura de pantalla.

---

## Producto / PWA

10. **La app instalada (PWA) necesita `env(safe-area-inset-top)`** o el contenido queda pegado
    a la barra de estado.
11. **Navegación con `pushState`** o el gesto "atrás" cierra la app.

---

## Despliegue

Los 4 gotchas de infraestructura están en `despliegue.md` §4.
