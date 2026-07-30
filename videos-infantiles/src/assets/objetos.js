/**
 * Biblioteca de objetos dibujados en SVG.
 *
 * Reglas del estilo visual (pensado para 2-4 anos):
 *  - Formas grandes y redondeadas, sin detalle fino.
 *  - Trazo oscuro y grueso para separar del fondo (alto contraste).
 *  - Colores planos y saturados, sin degradados ni sombras.
 *  - Todo dentro del viewBox 0 0 200 200 para poder escalar sin cortes.
 *
 * Cada objeto es una funcion (opciones) => string con el contenido SVG.
 * Los que aceptan `color` sirven para las lecciones de colores.
 */

export const TRAZO = '#2E2A3B';
const G = 9; // grosor del trazo

export const COLORES = {
  rojo: '#E63946',
  azul: '#1D7FE0',
  amarillo: '#FFC93C',
  verde: '#49B265',
  naranja: '#FF8A3D',
  morado: '#9B5DE5',
  rosado: '#FF7EB6',
  cafe: '#8D5A3B',
  negro: '#2E2A3B',
  blanco: '#FFFFFF',
  gris: '#A7B2C4',
};

/** Envuelve contenido en un <svg> con los atributos comunes de trazo. */
export function envolver(contenido) {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    stroke="${TRAZO}" stroke-width="${G}" stroke-linejoin="round" stroke-linecap="round">${contenido}</svg>`;
}

/* ---------- piezas reutilizables ---------- */

/** Par de ojos redondos con brillo. `abiertos` de 0 a 1 permite el parpadeo. */
function ojos(x1, x2, y, r = 13, abiertos = 1) {
  const ry = Math.max(1, r * abiertos);
  return `
    <ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${ry}" fill="${TRAZO}" stroke="none"/>
    <ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${ry}" fill="${TRAZO}" stroke="none"/>
    ${abiertos > 0.5 ? `
      <circle cx="${x1 + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#FFF" stroke="none"/>
      <circle cx="${x2 + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#FFF" stroke="none"/>` : ''}`;
}

/** Sonrisa como arco. */
function sonrisa(cx, cy, ancho = 34, alto = 18) {
  return `<path d="M ${cx - ancho / 2} ${cy} Q ${cx} ${cy + alto} ${cx + ancho / 2} ${cy}" fill="none"/>`;
}

/**
 * Dibuja un grupo de figuras como una sola silueta: primero el contorno grueso
 * y encima el relleno, de modo que los bordes internos desaparecen.
 * Sirve para nubes, melenas, lana y copas de arbol.
 */
function silueta(partes, relleno) {
  return `<g stroke="${TRAZO}" stroke-width="${G * 2}" fill="none">${partes}</g>` +
         `<g fill="${relleno}" stroke="none">${partes}</g>`;
}

/** Mejillas rosadas. */
function mejillas(x1, x2, y, r = 11) {
  return `
    <circle cx="${x1}" cy="${y}" r="${r}" fill="#FF9EB5" stroke="none" opacity="0.75"/>
    <circle cx="${x2}" cy="${y}" r="${r}" fill="#FF9EB5" stroke="none" opacity="0.75"/>`;
}

/* ---------- animales (cara grande, estilo tarjeta didactica) ---------- */

const animales = {
  perro: () => `
    <ellipse cx="46" cy="112" rx="24" ry="40" fill="#A66C3C"/>
    <ellipse cx="154" cy="112" rx="24" ry="40" fill="#A66C3C"/>
    <circle cx="100" cy="100" r="64" fill="#C98A54"/>
    <ellipse cx="100" cy="133" rx="36" ry="26" fill="#F2DFC7"/>
    <ellipse cx="100" cy="122" rx="14" ry="11" fill="${TRAZO}" stroke="none"/>
    ${sonrisa(100, 140, 30, 14)}
    ${ojos(78, 122, 88)}`,

  gato: () => `
    <path d="M 52 66 L 44 22 L 88 44 Z" fill="#F3A54A"/>
    <path d="M 148 66 L 156 22 L 112 44 Z" fill="#F3A54A"/>
    <circle cx="100" cy="104" r="62" fill="#FFB865"/>
    <path d="M 60 62 L 56 38 L 78 50 Z" fill="#FF9EB5" stroke="none"/>
    <path d="M 140 62 L 144 38 L 122 50 Z" fill="#FF9EB5" stroke="none"/>
    ${ojos(76, 124, 96)}
    <path d="M 100 118 l -9 8 l 9 6 l 9 -6 z" fill="#FF7EB6"/>
    <path d="M 92 134 Q 100 142 108 134" fill="none"/>
    <g stroke-width="6">
      <path d="M 28 108 L 62 114 M 26 126 L 62 126 M 172 108 L 138 114 M 174 126 L 138 126"/>
    </g>`,

  vaca: () => `
    <ellipse cx="40" cy="96" rx="22" ry="17" fill="#F0E6DA"/>
    <ellipse cx="160" cy="96" rx="22" ry="17" fill="#F0E6DA"/>
    <path d="M 62 52 Q 50 30 66 26" fill="none" stroke-width="11"/>
    <path d="M 138 52 Q 150 30 134 26" fill="none" stroke-width="11"/>
    <circle cx="100" cy="102" r="62" fill="#FBF6F0"/>
    <path d="M 66 62 q 22 -12 30 8 q -18 16 -30 -8 z" fill="${TRAZO}" stroke="none"/>
    <path d="M 146 118 q -14 -18 4 -26 q 16 12 -4 26 z" fill="${TRAZO}" stroke="none"/>
    <ellipse cx="100" cy="134" rx="38" ry="27" fill="#FFB6C8"/>
    <ellipse cx="88" cy="130" rx="6" ry="8" fill="${TRAZO}" stroke="none"/>
    <ellipse cx="112" cy="130" rx="6" ry="8" fill="${TRAZO}" stroke="none"/>
    ${ojos(78, 122, 90)}`,

  pato: () => `
    <circle cx="100" cy="104" r="62" fill="#FFD23F"/>
    <path d="M 92 46 q 8 -22 18 -8" fill="none" stroke-width="10"/>
    <path d="M 62 118 q 38 -14 76 0 q -38 26 -76 0 z" fill="#FF8A3D"/>
    <path d="M 66 120 h 68" fill="none" stroke-width="5"/>
    ${ojos(80, 122, 92)}
    ${mejillas(58, 144, 112, 10)}`,

  leon: () => `
    ${silueta(
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<circle cx="${(100 + Math.cos(a) * 60).toFixed(1)}" cy="${(102 + Math.sin(a) * 60).toFixed(1)}" r="25"/>`;
      }).join(''),
      '#E08A3C'
    )}
    <circle cx="100" cy="102" r="56" fill="#FFC65C"/>
    <ellipse cx="100" cy="128" rx="32" ry="22" fill="#FFE2A8"/>
    <path d="M 100 116 l -10 9 l 10 6 l 10 -6 z" fill="${TRAZO}" stroke="none"/>
    <path d="M 84 136 Q 100 148 116 136" fill="none"/>
    ${ojos(80, 120, 94)}`,

  elefante: () => `
    <circle cx="44" cy="94" r="34" fill="#93A0B5"/>
    <circle cx="156" cy="94" r="34" fill="#93A0B5"/>
    <circle cx="100" cy="96" r="58" fill="#AEBACB"/>
    <path d="M 100 122 q 20 26 4 48 q -12 18 12 22" fill="none" stroke="${TRAZO}" stroke-width="34"/>
    <path d="M 100 122 q 20 26 4 48 q -12 18 12 22" fill="none" stroke="#AEBACB" stroke-width="20"/>
    ${ojos(78, 122, 86, 12)}
    ${mejillas(60, 140, 108, 10)}`,

  rana: () => `
    <ellipse cx="100" cy="122" rx="66" ry="52" fill="#6BC24A"/>
    <circle cx="62" cy="72" r="28" fill="#7FD45C"/>
    <circle cx="138" cy="72" r="28" fill="#7FD45C"/>
    <circle cx="62" cy="74" r="13" fill="${TRAZO}" stroke="none"/>
    <circle cx="138" cy="74" r="13" fill="${TRAZO}" stroke="none"/>
    <circle cx="67" cy="69" r="4" fill="#FFF" stroke="none"/>
    <circle cx="143" cy="69" r="4" fill="#FFF" stroke="none"/>
    <path d="M 58 126 Q 100 162 142 126" fill="none"/>
    ${mejillas(52, 148, 116, 10)}`,

  cerdo: () => `
    <path d="M 54 68 L 48 30 L 88 48 Z" fill="#F79BB4"/>
    <path d="M 146 68 L 152 30 L 112 48 Z" fill="#F79BB4"/>
    <circle cx="100" cy="104" r="62" fill="#FFB6C8"/>
    <ellipse cx="100" cy="128" rx="34" ry="26" fill="#F98BAA"/>
    <ellipse cx="88" cy="126" rx="6" ry="9" fill="${TRAZO}" stroke="none"/>
    <ellipse cx="112" cy="126" rx="6" ry="9" fill="${TRAZO}" stroke="none"/>
    ${ojos(78, 122, 92)}`,

  oveja: () => `
    ${silueta(
      `<circle cx="56" cy="80" r="31"/><circle cx="100" cy="58" r="33"/>
       <circle cx="144" cy="80" r="31"/><circle cx="58" cy="126" r="31"/>
       <circle cx="142" cy="126" r="31"/><circle cx="100" cy="104" r="43"/>`,
      '#FBF6F0'
    )}
    <ellipse cx="100" cy="118" rx="38" ry="42" fill="#453C4F"/>
    <ellipse cx="62" cy="112" rx="16" ry="11" fill="#453C4F"/>
    <ellipse cx="138" cy="112" rx="16" ry="11" fill="#453C4F"/>
    ${ojos(86, 114, 112, 11)}
    ${sonrisa(100, 140, 24, 10)}`,

  panda: () => `
    <circle cx="52" cy="58" r="26" fill="${TRAZO}"/>
    <circle cx="148" cy="58" r="26" fill="${TRAZO}"/>
    <circle cx="100" cy="106" r="62" fill="#FBF6F0"/>
    <ellipse cx="76" cy="98" rx="20" ry="24" fill="${TRAZO}" stroke="none" transform="rotate(-14 76 98)"/>
    <ellipse cx="124" cy="98" rx="20" ry="24" fill="${TRAZO}" stroke="none" transform="rotate(14 124 98)"/>
    <circle cx="76" cy="98" r="8" fill="#FFF" stroke="none"/>
    <circle cx="124" cy="98" r="8" fill="#FFF" stroke="none"/>
    <ellipse cx="100" cy="128" rx="13" ry="10" fill="${TRAZO}" stroke="none"/>
    ${sonrisa(100, 144, 30, 14)}`,

  pollito: () => `
    <circle cx="100" cy="110" r="56" fill="#FFD23F"/>
    <path d="M 96 52 q 6 -20 16 -6" fill="none" stroke-width="9"/>
    <path d="M 88 112 l 24 0 l -12 14 z" fill="#FF8A3D"/>
    <ellipse cx="52" cy="118" rx="16" ry="22" fill="#FFC107"/>
    <ellipse cx="148" cy="118" rx="16" ry="22" fill="#FFC107"/>
    ${ojos(84, 116, 96, 11)}`,

  pez: ({ color = COLORES.naranja } = {}) => `
    <path d="M 148 100 L 186 66 L 186 134 Z" fill="${color}"/>
    <ellipse cx="94" cy="100" rx="70" ry="48" fill="${color}"/>
    <path d="M 94 52 q 18 16 0 30" fill="none" stroke-width="7"/>
    <circle cx="58" cy="92" r="12" fill="${TRAZO}" stroke="none"/>
    <circle cx="62" cy="87" r="4" fill="#FFF" stroke="none"/>
    <path d="M 40 112 Q 52 122 66 112" fill="none" stroke-width="7"/>`,

  abeja: () => `
    <ellipse cx="70" cy="60" rx="30" ry="20" fill="#CFE9FF" transform="rotate(-24 70 60)"/>
    <ellipse cx="130" cy="60" rx="30" ry="20" fill="#CFE9FF" transform="rotate(24 130 60)"/>
    <ellipse cx="100" cy="112" rx="62" ry="50" fill="#FFC93C"/>
    <path d="M 74 68 q 14 88 0 88" fill="none" stroke-width="16" stroke="${TRAZO}" opacity="0.9"/>
    <path d="M 126 68 q -14 88 0 88" fill="none" stroke-width="16" stroke="${TRAZO}" opacity="0.9"/>
    ${ojos(88, 112, 100, 10)}
    ${sonrisa(100, 122, 22, 10)}`,
};

/* ---------- frutas ---------- */

const frutas = {
  manzana: () => `
    <path d="M 100 46 q 6 -22 26 -26" fill="none" stroke-width="10"/>
    <path d="M 104 40 q 30 -22 46 4 q -30 20 -46 -4 z" fill="#49B265"/>
    <path d="M 100 58 q 34 -22 56 12 q 20 34 -6 74 q -22 34 -50 14 q -28 20 -50 -14 q -26 -40 -6 -74 q 22 -34 56 -12 z" fill="#E63946"/>
    <path d="M 74 92 q 8 -14 22 -16" fill="none" stroke="#FFF" stroke-width="8" opacity="0.5"/>`,

  banano: () => `
    <path d="M 44 52 q 6 96 106 106 q 26 4 12 -18 q -78 -14 -92 -92 q -6 -22 -26 4 z" fill="#FFD23F"/>
    <path d="M 44 52 q -6 -14 8 -12" fill="none" stroke-width="11"/>
    <path d="M 150 140 q 18 4 12 12" fill="none" stroke-width="11"/>`,

  uva: () => `
    <path d="M 100 44 q 4 -20 24 -22" fill="none" stroke-width="9"/>
    <path d="M 104 36 q 26 -20 40 2 q -26 18 -40 -2 z" fill="#49B265"/>
    <g fill="#9B5DE5">
      <circle cx="100" cy="70" r="22"/><circle cx="72" cy="98" r="22"/><circle cx="128" cy="98" r="22"/>
      <circle cx="100" cy="112" r="22"/><circle cx="80" cy="140" r="22"/><circle cx="120" cy="140" r="22"/>
      <circle cx="100" cy="164" r="22"/>
    </g>`,

  naranja: () => `
    <path d="M 100 44 q 30 -20 44 2 q -28 18 -44 -2 z" fill="#49B265"/>
    <circle cx="100" cy="114" r="66" fill="#FF8A3D"/>
    <g stroke="#E06A1F" stroke-width="6" opacity="0.7">
      <path d="M 100 50 v 128 M 40 96 q 60 26 120 0 M 44 138 q 56 -20 112 0"/>
    </g>`,

  sandia: () => `
    <path d="M 18 62 h 164 a 82 82 0 0 1 -164 0 z" fill="#49B265"/>
    <path d="M 30 74 h 140 a 70 70 0 0 1 -140 0 z" fill="#FBF6F0" stroke="none"/>
    <path d="M 40 82 h 120 a 60 60 0 0 1 -120 0 z" fill="#E63946" stroke="none"/>
    <g fill="${TRAZO}" stroke="none">
      <ellipse cx="72" cy="98" rx="5" ry="8"/><ellipse cx="100" cy="112" rx="5" ry="8"/>
      <ellipse cx="128" cy="98" rx="5" ry="8"/><ellipse cx="86" cy="126" rx="5" ry="8"/>
      <ellipse cx="114" cy="126" rx="5" ry="8"/>
    </g>`,

  fresa: () => `
    <path d="M 100 52 q 34 -26 44 -2 q 18 -14 20 10 q -30 12 -64 -8 z" fill="#49B265"/>
    <path d="M 100 52 q -34 -26 -44 -2 q -18 -14 -20 10 q 30 12 64 -8 z" fill="#49B265"/>
    <path d="M 100 56 q 62 6 58 60 q -4 54 -58 68 q -54 -14 -58 -68 q -4 -54 58 -60 z" fill="#E63946"/>
    <g fill="#FFD23F" stroke="none">
      <ellipse cx="78" cy="94" rx="5" ry="7"/><ellipse cx="122" cy="94" rx="5" ry="7"/>
      <ellipse cx="100" cy="116" rx="5" ry="7"/><ellipse cx="70" cy="126" rx="5" ry="7"/>
      <ellipse cx="130" cy="126" rx="5" ry="7"/><ellipse cx="100" cy="150" rx="5" ry="7"/>
    </g>`,
};

/* ---------- formas geometricas (aceptan color) ---------- */

const formas = {
  circulo: ({ color = COLORES.azul } = {}) => `<circle cx="100" cy="100" r="74" fill="${color}"/>`,

  cuadrado: ({ color = COLORES.rojo } = {}) =>
    `<rect x="30" y="30" width="140" height="140" rx="18" fill="${color}"/>`,

  triangulo: ({ color = COLORES.amarillo } = {}) =>
    `<path d="M 100 26 L 176 166 L 24 166 Z" fill="${color}"/>`,

  rectangulo: ({ color = COLORES.verde } = {}) =>
    `<rect x="18" y="56" width="164" height="88" rx="16" fill="${color}"/>`,

  estrella: ({ color = COLORES.amarillo } = {}) => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 78 : 34;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      p.push(`${(100 + Math.cos(a) * r).toFixed(1)} ${(102 + Math.sin(a) * r).toFixed(1)}`);
    }
    return `<path d="M ${p.join(' L ')} Z" fill="${color}"/>`;
  },

  corazon: ({ color = COLORES.rosado } = {}) => `
    <path d="M 100 168 C 20 116 24 52 62 44 C 84 38 98 56 100 68 C 102 56 116 38 138 44 C 176 52 180 116 100 168 Z" fill="${color}"/>`,

  rombo: ({ color = COLORES.morado } = {}) =>
    `<path d="M 100 22 L 172 100 L 100 178 L 28 100 Z" fill="${color}"/>`,

  ovalo: ({ color = COLORES.naranja } = {}) =>
    `<ellipse cx="100" cy="100" rx="76" ry="56" fill="${color}"/>`,
};

/* ---------- vehiculos y objetos varios ---------- */

const varios = {
  pelota: ({ color = COLORES.rojo } = {}) => `
    <circle cx="100" cy="100" r="72" fill="${color}"/>
    <path d="M 100 28 v 144 M 28 100 h 144" fill="none" stroke-width="7"/>
    <path d="M 48 52 q 52 48 0 96 M 152 52 q -52 48 0 96" fill="none" stroke-width="7"/>`,

  globo: ({ color = COLORES.morado } = {}) => `
    <path d="M 100 148 q -10 12 4 26 q -14 10 -2 22" fill="none" stroke-width="6"/>
    <ellipse cx="100" cy="86" rx="58" ry="68" fill="${color}"/>
    <path d="M 100 154 l -12 -12 h 24 z" fill="${color}"/>
    <path d="M 74 56 q 10 -16 26 -18" fill="none" stroke="#FFF" stroke-width="9" opacity="0.55"/>`,

  carro: ({ color = COLORES.azul } = {}) => `
    <path d="M 20 132 v -26 q 0 -10 12 -12 l 20 -4 l 22 -26 q 6 -8 18 -8 h 42 q 12 0 18 10 l 16 24 l 14 4 q 12 4 12 14 v 24 z" fill="${color}"/>
    <path d="M 92 62 h 30 q 8 0 12 8 l 12 18 h -54 z" fill="#CFE9FF"/>
    <path d="M 58 88 l 16 -20 q 4 -6 12 -6 v 26 z" fill="#CFE9FF"/>
    <circle cx="60" cy="136" r="24" fill="${TRAZO}"/>
    <circle cx="60" cy="136" r="9" fill="#FBF6F0" stroke="none"/>
    <circle cx="142" cy="136" r="24" fill="${TRAZO}"/>
    <circle cx="142" cy="136" r="9" fill="#FBF6F0" stroke="none"/>`,

  bus: ({ color = COLORES.amarillo } = {}) => `
    <rect x="16" y="52" width="168" height="86" rx="16" fill="${color}"/>
    <g fill="#CFE9FF">
      <rect x="32" y="66" width="34" height="30" rx="6"/>
      <rect x="76" y="66" width="34" height="30" rx="6"/>
      <rect x="120" y="66" width="34" height="30" rx="6"/>
    </g>
    <circle cx="56" cy="144" r="22" fill="${TRAZO}"/>
    <circle cx="56" cy="144" r="8" fill="#FBF6F0" stroke="none"/>
    <circle cx="146" cy="144" r="22" fill="${TRAZO}"/>
    <circle cx="146" cy="144" r="8" fill="#FBF6F0" stroke="none"/>`,

  avion: ({ color = COLORES.blanco } = {}) => `
    <path d="M 26 108 q 44 -26 108 -24 l 44 20 l -44 20 q -64 2 -108 -16 z" fill="${color}"/>
    <path d="M 76 88 l 18 -46 l 16 0 l -6 46 z" fill="#1D7FE0"/>
    <path d="M 76 118 l 18 44 l 16 0 l -6 -44 z" fill="#1D7FE0"/>
    <circle cx="146" cy="102" r="9" fill="#CFE9FF"/>`,

  barco: ({ color = COLORES.rojo } = {}) => `
    <path d="M 30 120 h 140 l -22 40 h -96 z" fill="${color}"/>
    <path d="M 100 116 v -86" fill="none" stroke-width="10"/>
    <path d="M 106 34 l 52 74 h -52 z" fill="#FFD23F"/>
    <path d="M 94 52 l -40 56 h 40 z" fill="#FBF6F0"/>
    <path d="M 14 168 q 24 -14 44 0 q 24 -14 44 0 q 24 -14 44 0 q 20 -12 40 0" fill="none" stroke="#1D7FE0" stroke-width="8"/>`,

  tren: ({ color = COLORES.verde } = {}) => `
    <rect x="94" y="86" width="86" height="54" rx="10" fill="${color}"/>
    <path d="M 22 60 h 56 q 10 0 10 10 v 70 h -76 v -70 q 0 -10 10 -10 z" fill="${color}"/>
    <rect x="34" y="74" width="32" height="28" rx="6" fill="#CFE9FF"/>
    <rect x="110" y="98" width="26" height="26" rx="6" fill="#CFE9FF"/>
    <rect x="146" y="98" width="26" height="26" rx="6" fill="#CFE9FF"/>
    <path d="M 60 60 v -18 h 24 v 18" fill="#2E2A3B"/>
    <circle cx="44" cy="150" r="17" fill="${TRAZO}"/>
    <circle cx="112" cy="150" r="17" fill="${TRAZO}"/>
    <circle cx="162" cy="150" r="17" fill="${TRAZO}"/>`,

  sol: () => `
    <g stroke-width="12">
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x1 = 100 + Math.cos(a) * 62, y1 = 100 + Math.sin(a) * 62;
        const x2 = 100 + Math.cos(a) * 88, y2 = 100 + Math.sin(a) * 88;
        return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
      }).join('')}
    </g>
    <circle cx="100" cy="100" r="56" fill="#FFC93C"/>
    ${ojos(84, 116, 94, 9)}
    ${sonrisa(100, 116, 26, 12)}`,

  nube: () => silueta(
    `<circle cx="68" cy="112" r="34"/><circle cx="100" cy="86" r="42"/>
     <circle cx="138" cy="108" r="32"/>
     <rect x="34" y="110" width="134" height="36" rx="18"/>`,
    '#FBF6F0'
  ),

  /**
   * Nube de decoracion, sin contorno: se queda en el fondo y nunca compite
   * visualmente con el objeto que el nino tiene que mirar.
   */
  nubeSuave: () => `
    <g fill="#FFFFFF" stroke="none">
      <circle cx="68" cy="112" r="36"/><circle cx="100" cy="84" r="44"/>
      <circle cx="140" cy="108" r="34"/>
      <rect x="32" y="108" width="138" height="40" rx="20"/>
    </g>`,

  flor: ({ color = COLORES.rosado } = {}) => `
    <path d="M 100 130 v 48" fill="none" stroke-width="10"/>
    <path d="M 100 152 q 26 -16 34 4 q -26 12 -34 -4 z" fill="#49B265"/>
    <g fill="${color}">
      ${Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return `<ellipse cx="${(100 + Math.cos(a) * 38).toFixed(1)}" cy="${(84 + Math.sin(a) * 38).toFixed(1)}" rx="24" ry="24"/>`;
      }).join('')}
    </g>
    <circle cx="100" cy="84" r="24" fill="#FFD23F"/>`,

  casa: ({ color = COLORES.amarillo } = {}) => `
    <rect x="40" y="94" width="120" height="80" rx="8" fill="${color}"/>
    <path d="M 26 96 L 100 34 L 174 96 Z" fill="#E63946"/>
    <rect x="86" y="124" width="34" height="50" rx="5" fill="#8D5A3B"/>
    <rect x="54" y="112" width="26" height="26" rx="5" fill="#CFE9FF"/>
    <rect x="126" y="112" width="26" height="26" rx="5" fill="#CFE9FF"/>`,

  arbol: () => `
    <rect x="84" y="104" width="32" height="72" rx="10" fill="#8D5A3B"/>
    ${silueta(
      `<circle cx="100" cy="72" r="48"/><circle cx="58" cy="98" r="34"/><circle cx="142" cy="98" r="34"/>`,
      '#49B265'
    )}`,
};

export const OBJETOS = { ...animales, ...frutas, ...formas, ...varios };

/** Sonidos onomatopeyicos para las lecciones de animales. */
export const SONIDOS = {
  perro: 'GUAU GUAU', gato: 'MIAU', vaca: 'MUUU', pato: 'CUAC CUAC',
  leon: 'GRRR', elefante: 'PRUUU', rana: 'CROAC', cerdo: 'OINC OINC',
  oveja: 'BEEE', pollito: 'PIO PIO', abeja: 'BZZZ', panda: '', pez: '',
};

/** Devuelve el SVG completo de un objeto. `nombre` puede traer color: "pelota:verde". */
export function dibujar(nombre, opciones = {}) {
  const [clave, colorNombre] = String(nombre).split(':');
  const fn = OBJETOS[clave];
  if (!fn) throw new Error(`Objeto desconocido: "${clave}". Disponibles: ${Object.keys(OBJETOS).join(', ')}`);
  const color = opciones.color ?? (colorNombre ? COLORES[colorNombre] ?? colorNombre : undefined);
  return envolver(fn({ ...opciones, ...(color ? { color } : {}) }));
}

export { ojos, sonrisa, mejillas };
