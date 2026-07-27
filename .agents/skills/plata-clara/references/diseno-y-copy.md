# Diseño (sistema Nocturne) y tono del copy

Tokens en `client/src/theme.css` — **usar variables, nunca hex sueltos**.
Diseño base: `Plata Clara_ revisión de prototipo.zip` (sistema **Nocturne**).

---

## Tokens

| Token | Valor |
|---|---|
| `--bg` | `#161826` (fondo) |
| superficie | `#232532` |
| texto | `#e9e9ed` |
| acento (**blurple**) | `#9184d9` |
| `--pos` | verde |
| `--warn` | ámbar |
| `--neg` | rojo |

Cada semántico tiene su variante `bg`.

**Glass:** `--glass` + `backdrop-filter: blur(12px)` + `--glassline` + `--float-sh`

---

## Reglas visuales

- Tipografía **Inter**; headings weight **500** (nunca más bold); jerarquía por tamaño, no por
  peso.
- **Botón primario = contorno del acento, NUNCA relleno sólido.**
- Números siempre `font-variant-numeric: tabular-nums` (clase `.num`).
- Inputs nunca por debajo de 16px (evita el zoom en móvil).
- Temas claro/oscuro + **modo privacidad** (`$ ••••••`), ambos en `localStorage`.
- Formato de dinero siempre `es-CO`: `$ 1.850.000` — usar `fmt()` / `fmtPriv()` de
  `client/src/format.ts`.

---

## Tono del copy (regla del PRD)

**La app nunca regaña. Informa y propone.**

| ❌ No | ✅ Sí |
|---|---|
| "Otra vez te pasaste del presupuesto" | "Vas $120.000 por encima de lo planeado este mes" |
| "Estás gastando demasiado en domicilios" | "Domicilios es tu categoría más alta: $340.000" |
| "Deberías ahorrar más" | "Si guardas $200.000 más al mes, llegas a tu meta en marzo" |

Textos legales obligatorios:
- *"Plata Clara organiza, no asesora"*
- *"estimados, no garantías"*

Referencias de voz: skill `voz-david` · copy: skill `copywriting-persuasivo`.
