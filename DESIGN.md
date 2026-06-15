---
name: Grupo 500
description: Plataforma Pre-ICFES — panel de gestión administrativa (admin dashboard, autenticado, orientado a tareas)
colors:
  primary: "#2094ff"
  primary-container: "#cce4ff"
  primary-dim: "#95daff"
  secondary: "#4361ee"
  tertiary: "#635cef"
  navy: "#003060"
  surface-lowest: "#ffffff"
  surface-low: "#e4f0ff"
  surface: "#d8eaff"
  surface-high: "#c8deff"
  on-surface: "#001d3d"
  on-surface-variant: "#2a4172"
  outline: "#5a74a8"
  outline-variant: "#c2d4ef"
  error: "#c0392b"
  positive: "#16a34a"
  negative: "#dc2626"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  card:
    backgroundColor: "{colors.surface-lowest}"
    rounded: "{rounded.lg}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-lowest}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  chip-success:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Grupo 500

## 1. Overview

**Creative North Star: "El Tablero Claro"**

Grupo 500 es el panel interno con el que el equipo de un preuniversitario (Pre-ICFES) en Colombia gestiona estudiantes, ventas y asesores. El diseño SIRVE a la tarea: el administrador entra a revisar números y mover gente por el embudo, no a contemplar la interfaz. La estética es la de un tablero limpio y confiable, azul como la marca, con datos legibles de un vistazo y cero ruido decorativo.

La densidad es media-alta pero respira: tarjetas claras sobre un fondo azulado suave, tipografía Inter en una sola familia para todo (títulos, etiquetas, datos), y el acento azul reservado para lo accionable y los montos clave. El sistema rechaza explícitamente el "SaaS genérico oscuro con gradientes morados", el glassmorphism decorativo y las tarjetas anidadas. Si una pantalla se ve como una plantilla de dashboard de marketplace, está mal.

**Key Characteristics:**
- Una sola familia tipográfica (Inter) para toda la jerarquía
- Superficies azuladas tintadas, nunca gris ni blanco puro percibido
- Acento azul (`#2094ff`) solo para acciones, selección y montos clave
- Tarjetas planas con borde sutil; profundidad por capas tonales, no por sombras fuertes
- Verde/rojo exclusivos para variación (sube/baja), nunca decorativos
- Modo claro y oscuro de primera clase

## 2. Colors

Paleta monocromática azul (educación, confianza) con neutrales tintados hacia el navy de marca.

### Primary
- **Azul Brillante** (#2094ff): el acento de la marca. Acciones primarias, selección actual, montos clave (total facturado), enlaces activos. Su escasez es lo que lo hace funcionar.
- **Azul Cielo** (#95daff): variante del acento en modo oscuro y para gráficas; relleno de áreas y barras.
- **Azul Contenedor** (#cce4ff): fondos tonales suaves (chips, avatares de inicial, estados seleccionados).

### Secondary
- **Índigo** (#4361ee): segundo rol de datos, etiquetas de chips de éxito, diferenciación en gráficas multi-serie.

### Tertiary
- **Púrpura** (#635cef): tercer rol de datos y chips de advertencia.

### Neutral
- **Navy Texto** (#001d3d): texto principal sobre superficies claras.
- **Navy Suave** (#2a4172): texto secundario, etiquetas, ejes de gráficas.
- **Outline Variant** (#c2d4ef): bordes de tarjetas y divisores.
- **Superficies** (#ffffff → #c8deff): escala de superficies azuladas; `surface-lowest` para tarjetas, `surface-high` para filas tonales y elementos elevados dentro de tarjetas.

### Estado (semántico)
- **Verde Positivo** (#16a34a claro / #6ee7b7 oscuro): solo para variación al alza.
- **Rojo Negativo** (#dc2626 claro / #f87171 oscuro): solo para variación a la baja.
- **Error** (#c0392b claro / #ffb4ab oscuro): validaciones y acciones destructivas.

### Named Rules
**La Regla del Acento Escaso.** El azul brillante (`#2094ff`) vive en ≤10% de cualquier pantalla: acciones, selección y montos clave. Si tiñe fondos o decoración, se diluye y deja de comunicar.

**La Regla Verde-Rojo.** Verde y rojo SOLO significan "subió/bajó" o estado. Prohibido usarlos como color decorativo o de marca.

## 3. Typography

**Familia única:** Inter (con fallback `system-ui, sans-serif`), pesos 400/500/600/700.

**Character:** Inter es neutra, técnica y legible a tamaños pequeños, ideal para datos densos. Una sola familia carga toda la jerarquía: el contraste se logra con peso y tamaño, no con cambio de fuente.

### Hierarchy
- **Display** (700, 22px, line-height 1.1): saludo del dashboard y títulos de página. Único punto de tamaño grande.
- **Title** (600, 15px): títulos de tarjeta y nombres en listas.
- **Body** (400-500, 13px): texto y datos generales; números en `tabular-nums`.
- **Label** (600, 10px, letter-spacing 0.06em, MAYÚSCULAS): encabezados de sección ("RESUMEN DEL MES"), metadatos.

### Named Rules
**La Regla de Una Voz Tipográfica.** Nunca se introduce una segunda familia (display/serif). Toda la jerarquía es Inter; el contraste es peso + tamaño.

## 4. Elevation

Sistema mayormente plano con capas tonales. La profundidad se comunica cambiando de superficie (`surface-lowest` → `surface-high`), no con sombras pronunciadas. Las tarjetas llevan una sombra mínima (`--shadow-card`) que en modo oscuro es casi solo un borde de 1px.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 3px rgba(0,48,96,0.08), 0 0 0 1px rgba(0,48,96,0.07)`): reposo de tarjetas.
- **Float** (`0 8px 24px rgba(0,48,96,0.14)`): popovers, menús, modales (elementos que flotan sobre el contenido).

### Named Rules
**La Regla Plana por Defecto.** Las superficies son planas en reposo. La elevación fuerte (Float) solo aparece en elementos que realmente flotan (dropdowns, modales), nunca en tarjetas de contenido.

## 5. Components

### Cards / Containers
- **Esquinas:** 12px (`rounded-lg` / clase `.card`).
- **Fondo:** `surface-lowest`. Filas internas tonales usan `surface-high` SIN borde propio.
- **Borde:** 1px `outline-variant`.
- **Sombra:** `--shadow-card` (mínima).
- **Padding interno:** 16-20px.
- **Regla:** prohibidas las tarjetas anidadas con doble borde. Una fila dentro de una tarjeta es tonal (fondo), no otra tarjeta bordeada.

### Buttons
- **Forma:** 8px (`rounded-md`) para botones, 12px para botones grandes.
- **Primary:** fondo `primary`, texto blanco, padding 8px 16px.
- **Ghost:** transparente, texto `on-surface-variant`, hover a `surface-high`.
- **Hover/Focus:** transición de color 150-200ms ease-out; nunca scale que desplace el layout.

### Chips
- **Forma:** pill (999px), padding 2px 10px, 12px font.
- **Success / Warning / Error:** fondo contenedor tonal + texto del color del rol + borde `color-mix` al 20%.

### Inputs
- **Estilo:** borde `outline-variant`, fondo `surface-high`, radio 8-12px.
- **Focus:** borde a `primary` + ring sutil.
- **Móvil:** `font-size: 16px` para evitar zoom de iOS.

### Popover / MonthPicker (signature)
- Se renderiza en **portal** con posición `fixed` y clamp al viewport, para que `overflow` del `<main>` no lo recorte. Eje fijo a la izquierda en gráficas scrolleables.

## 6. Do's and Don'ts

### Do:
- **Do** usar la clase `.card` y los tokens `--surface-*` / `--outline-variant` para todo contenedor; nunca estilos de borde/sombra inline.
- **Do** reservar el azul `#2094ff` para acciones, selección y montos clave (≤10% de la pantalla).
- **Do** mantener una sola familia tipográfica (Inter); jerarquía por peso y tamaño.
- **Do** usar `tabular-nums` en todos los montos y porcentajes.
- **Do** hacer verde/rojo sensibles al tema para contraste legible en modo oscuro.
- **Do** transiciones de 150-250ms ease-out en estados (hover/focus).

### Don't:
- **Don't** usar `#fff` ni `#000` literales; siempre tokens de superficie tintados.
- **Don't** anidar tarjetas con doble borde; las filas internas son tonales.
- **Don't** usar gradientes morados, glassmorphism decorativo ni "SaaS oscuro genérico".
- **Don't** usar borde lateral de color (`border-left` >1px) como acento.
- **Don't** usar verde/rojo como color decorativo o de marca; solo significan variación/estado.
- **Don't** animar propiedades de layout (width/height/top/left) ni usar bounce/elastic.
- **Don't** introducir una segunda fuente display/serif en la UI.
