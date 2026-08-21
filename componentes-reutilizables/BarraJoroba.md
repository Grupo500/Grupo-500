# Barra con joroba (navegación móvil)

Barra inferior de navegación para celular construida el 21-ago-2026 y
reemplazada ese mismo día por la "barra riel" (el sidebar acostado). Se
guarda completa aquí para reutilizarla cuando se quiera: no está montada en
la app, pero funciona tal cual.

## Qué hace

- De borde a borde, asentada al fondo, en el azul del chrome (#15203a).
- El icono de la sección activa sube 18px a un círculo azul primario
  (#2094ff, 64px) y la barra levanta una JOROBA debajo para recibirlo — un
  `clipPath` (202.9×45.5) sobre un rectángulo del color de la barra, 2.24
  veces el diámetro del círculo.
- Las líneas del icono activo se dibujan de un trazo (clase `trazo-icono`,
  ver abajo). Sin rótulos: los iconos hablan solos.
- La joroba viaja entre pestañas con Web Animations API y puntos explícitos
  (0.8s, cubic-bezier(.45,0,.15,1)) — NO con transiciones CSS, que se tragan
  el viaje cuando la navegación de Next comprime los cuadros.
- La pestaña activa se recuerda FUERA del componente (`memoriaActiva`): cada
  área monta su propia barra y al navegar entre áreas nace de cero.
- Se esconde al hacer scroll (cualquier dirección) y vuelve al detenerse; el
  scroll de la propia navegación no cuenta (ventana de 1s tras el cambio).
- Aire inferior: `max(env(safe-area-inset-bottom), 18px)` — el mayor, no la
  suma.

## Cómo se usa

```tsx
import { BarraJoroba, type PestanaBarra } from './BarraJoroba'

<BarraJoroba pestanas={[
  { key: '/dashboard', label: 'Inicio', icon: Home, href: '/dashboard', activa: true },
  // ...cuatro módulos y "Más" (onClick en vez de href) de último
]} />
```

## CSS que necesita (vivía en globals.css)

```css
@keyframes trazo-icono {
  from { stroke-dashoffset: 100; }
  to   { stroke-dashoffset: 0; }
}
/* El componente pone pathLength=100 en cada trazo por JS: sin eso un trazo
   corto pasa casi toda la animación invisible y aparece de golpe. */
.trazo-icono svg path, .trazo-icono svg circle, .trazo-icono svg rect,
.trazo-icono svg line, .trazo-icono svg polyline {
  stroke-dasharray: 100 100;
  animation: trazo-icono 0.8s cubic-bezier(0.5, 0, 0.2, 1) 0.08s both;
}
```

## Advertencias ganadas a pulso

- Nada de `filter: drop-shadow` en un contenedor con hijos animados: se
  re-rasteriza entero en cada cuadro y en teléfono va a saltos. `box-shadow`
  en la barra; si un hijo necesita sombra de silueta, la lleva él mismo.
- El widget de diseño de referencia quedó en el historial de la Sesión 044.
