/**
 * Lulo: la mascota del canal.
 *
 * Es un personaje redondo inspirado en el lulo (fruta colombiana): cuerpo
 * naranja, hoja verde en la cabeza, ojos grandes y cachetes rosados.
 * Se dibuja una sola vez y se anima moviendo atributos de sus partes,
 * para que el render por cuadros sea rapido y deterministico.
 *
 * El viewBox es mas ancho que el cuerpo a proposito: los brazos necesitan
 * espacio para levantarse sin que el SVG los recorte.
 *
 * Partes animables (por id):
 *   #m-cuerpo      escala/rebote general
 *   #m-brazo-izq   rotacion (saludo)
 *   #m-brazo-der   rotacion
 *   #m-ojo-izq     ry (parpadeo)
 *   #m-ojo-der     ry (parpadeo)
 *   #m-boca        escala vertical (habla)
 *   #m-hoja        rotacion (viento)
 */

const TRAZO = '#2E2A3B';
const NARANJA = '#FF9F45';
const NARANJA_CLARO = '#FFC078';

// Geometria base: cuerpo centrado en (170,180) con radio 100x96.
export const PIVOTES = {
  brazoIzq: [78, 192],
  brazoDer: [262, 192],
  hoja: [170, 78],
  cuerpo: [170, 330],
};

export function mascotaSVG() {
  return `
<svg viewBox="0 0 340 350" xmlns="http://www.w3.org/2000/svg"
     stroke="${TRAZO}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
  <g id="m-cuerpo">
    <!-- piernas y pies -->
    <path d="M 146 268 v 42 M 194 268 v 42" fill="none" stroke-width="13"/>
    <ellipse cx="140" cy="320" rx="26" ry="15" fill="${NARANJA}"/>
    <ellipse cx="200" cy="320" rx="26" ry="15" fill="${NARANJA}"/>

    <!-- brazos: salen del borde del cuerpo hacia arriba y afuera -->
    <g id="m-brazo-izq">
      <path d="M 82 194 q -42 6 -60 -42" fill="none" stroke-width="14"/>
      <circle cx="20" cy="146" r="16" fill="${NARANJA_CLARO}"/>
    </g>
    <g id="m-brazo-der">
      <path d="M 258 194 q 42 6 60 -42" fill="none" stroke-width="14"/>
      <circle cx="320" cy="146" r="16" fill="${NARANJA_CLARO}"/>
    </g>

    <!-- hoja -->
    <g id="m-hoja">
      <path d="M 170 88 q 4 -36 -24 -48 q -15 32 24 48 z" fill="#49B265"/>
      <path d="M 170 88 q 13 -34 44 -36 q -4 34 -44 36 z" fill="#5CC470"/>
    </g>

    <!-- cuerpo -->
    <ellipse cx="170" cy="180" rx="100" ry="96" fill="${NARANJA}"/>
    <ellipse cx="170" cy="204" rx="68" ry="60" fill="${NARANJA_CLARO}" stroke="none"/>

    <!-- cara -->
    <ellipse cx="133" cy="160" rx="25" ry="27" fill="#FBF6F0"/>
    <ellipse cx="207" cy="160" rx="25" ry="27" fill="#FBF6F0"/>
    <ellipse id="m-ojo-izq" cx="135" cy="164" rx="12.5" ry="14" fill="${TRAZO}" stroke="none"/>
    <ellipse id="m-ojo-der" cx="209" cy="164" rx="12.5" ry="14" fill="${TRAZO}" stroke="none"/>
    <circle cx="140" cy="158" r="4.5" fill="#FFF" stroke="none"/>
    <circle cx="214" cy="158" r="4.5" fill="#FFF" stroke="none"/>

    <circle cx="98" cy="196" r="14" fill="#FF7EB6" stroke="none" opacity="0.7"/>
    <circle cx="242" cy="196" r="14" fill="#FF7EB6" stroke="none" opacity="0.7"/>

    <g id="m-boca">
      <path d="M 144 206 q 26 28 52 0 z" fill="${TRAZO}" stroke="none"/>
      <path d="M 144 206 q 26 28 52 0" fill="none" stroke-width="7"/>
      <path d="M 161 224 q 9 9 18 0 q -9 -5 -18 0 z" fill="#FF7EB6" stroke="none"/>
    </g>
  </g>
</svg>`;
}

/**
 * Aplica un estado de animacion a la mascota ya montada.
 * @param {Element} raiz  contenedor que tiene el SVG de la mascota
 * @param {object} estado {rebote, saludo, parpadeo, habla, inclinacion}
 */
export function animarMascota(raiz, estado = {}) {
  const { rebote = 0, saludo = 0, parpadeo = 1, habla = 0, inclinacion = 0 } = estado;
  const $ = (id) => raiz.querySelector('#' + id);

  const cuerpo = $('m-cuerpo');
  if (cuerpo) {
    // El rebote comprime y estira: sensacion de peso sin mover el piso.
    const escalaY = 1 + rebote * 0.05;
    const escalaX = 1 - rebote * 0.04;
    const [px, py] = PIVOTES.cuerpo;
    cuerpo.setAttribute(
      'transform',
      `translate(${px} ${py}) rotate(${(inclinacion * 5).toFixed(2)}) ` +
      `scale(${escalaX.toFixed(4)} ${escalaY.toFixed(4)}) translate(${-px} ${-py})`
    );
  }

  const bi = $('m-brazo-izq');
  if (bi) bi.setAttribute('transform', `rotate(${(saludo * 46).toFixed(2)} ${PIVOTES.brazoIzq.join(' ')})`);

  const bd = $('m-brazo-der');
  if (bd) bd.setAttribute('transform', `rotate(${(-saludo * 46).toFixed(2)} ${PIVOTES.brazoDer.join(' ')})`);

  const hoja = $('m-hoja');
  if (hoja) hoja.setAttribute('transform', `rotate(${(inclinacion * 12).toFixed(2)} ${PIVOTES.hoja.join(' ')})`);

  for (const id of ['m-ojo-izq', 'm-ojo-der']) {
    const ojo = $(id);
    if (ojo) ojo.setAttribute('ry', Math.max(1.2, 14 * parpadeo).toFixed(2));
  }

  const boca = $('m-boca');
  if (boca) {
    const s = 1 + habla * 0.7;
    boca.setAttribute('transform', `translate(170 206) scale(1 ${s.toFixed(3)}) translate(-170 -206)`);
  }
}
