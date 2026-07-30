/**
 * Motor de animacion.
 *
 * El video se modela como una funcion del tiempo: __seek(t) coloca cada
 * elemento en la posicion exacta que le corresponde en el segundo t.
 * No se usan animaciones CSS ni requestAnimationFrame porque el render
 * avanza cuadro por cuadro y necesita ser 100% reproducible.
 */

import { dibujar, COLORES, SONIDOS } from './assets/objetos.js';
import { mascotaSVG, animarMascota } from './assets/mascota.js';

export const ANCHO = 1920;
export const ALTO = 1080;

/* ---------------- utilidades ---------------- */

const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Progreso 0..1 de t dentro del tramo [a,b]. */
const tramo = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : lim((t - a) / (b - a)));

const suaveOut = (x) => 1 - Math.pow(1 - x, 3);
const suaveInOut = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
const rebotePop = (x, s = 1.9) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
/** Oscilacion suave centrada en 0. */
const vaiven = (t, periodo = 2) => Math.sin((t / periodo) * Math.PI * 2);

/** Generador pseudoaleatorio con semilla: mismo guion => mismo resultado. */
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function semillaDe(texto) {
  let h = 2166136261;
  for (const c of String(texto)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function nuevo(tag, clase, html) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (html != null) el.innerHTML = html;
  return el;
}

/** Parpadeo natural: ojos abiertos casi siempre, cierre rapido cada pocos segundos. */
function parpadeoEn(t, desfase = 0) {
  const ciclo = 3.4;
  const f = ((t + desfase) % ciclo) / ciclo;
  if (f > 0.955) return Math.abs(Math.cos((f - 0.955) / 0.045 * Math.PI));
  return 1;
}

/** Movimiento de boca al hablar: solo si la escena tiene narracion. */
function bocaEn(t, hablando) {
  if (!hablando) return 0;
  return (Math.sin(t * 11.5) * 0.5 + 0.5) * (Math.sin(t * 4.3) * 0.3 + 0.7);
}

/* ---------------- fondos ---------------- */

const FONDOS = {
  pradera: `
    <div class="cielo" style="background:linear-gradient(#8ED7FF 0%,#CFF0FF 62%)"></div>
    <div class="nubes"></div>
    <svg class="colinas" viewBox="0 0 1920 420" preserveAspectRatio="none">
      <path d="M0 190 Q 300 90 620 180 T 1280 170 T 1920 200 L1920 420 L0 420Z" fill="#7FD45C"/>
      <path d="M0 268 Q 420 190 900 262 T 1920 250 L1920 420 L0 420Z" fill="#49B265"/>
    </svg>`,
  cielo: `
    <div class="cielo" style="background:linear-gradient(#A8E1FF 0%,#E8F7FF 100%)"></div>
    <div class="nubes"></div>`,
  arcoiris: `
    <div class="cielo" style="background:linear-gradient(#FFF6DC 0%,#FFE9F2 100%)"></div>
    <svg class="colinas" viewBox="0 0 1920 1080" preserveAspectRatio="none" style="height:100%">
      <g opacity="0.35">
        <circle cx="960" cy="1180" r="900" fill="#FF7EB6"/><circle cx="960" cy="1180" r="800" fill="#FF8A3D"/>
        <circle cx="960" cy="1180" r="700" fill="#FFC93C"/><circle cx="960" cy="1180" r="600" fill="#7FD45C"/>
        <circle cx="960" cy="1180" r="500" fill="#5BC8F5"/><circle cx="960" cy="1180" r="400" fill="#9B5DE5"/>
        <circle cx="960" cy="1180" r="300" fill="#FFF6DC"/>
      </g>
    </svg>`,
  cuarto: `
    <div class="cielo" style="background:linear-gradient(#FFE7C7 0%,#FFF6E8 100%)"></div>
    <svg class="colinas" viewBox="0 0 1920 260" preserveAspectRatio="none">
      <rect width="1920" height="260" fill="#E8B98A"/>
      <rect width="1920" height="26" fill="#D6A473"/>
    </svg>`,
};

function montarFondo(nombre) {
  const el = nuevo('div', 'fondo', FONDOS[nombre] || FONDOS.pradera);
  const capaNubes = el.querySelector('.nubes');
  const nubes = [];
  if (capaNubes) {
    const r = azar(semillaDe('nubes' + nombre));
    for (let i = 0; i < 4; i++) {
      const n = nuevo('div', 'nube', dibujar('nubeSuave'));
      const escala = 0.7 + r() * 0.8;
      const datos = { x0: r() * 2200 - 200, y: 10 + r() * 190, escala, vel: 7 + r() * 9 };
      n.style.width = `${260 * escala}px`;
      capaNubes.appendChild(n);
      nubes.push({ el: n, ...datos });
    }
  }
  return {
    el,
    animar(t) {
      for (const n of nubes) {
        const x = ((n.x0 + t * n.vel) % 2400) - 300;
        n.el.style.transform = `translate(${x.toFixed(1)}px,${n.y.toFixed(1)}px)`;
      }
    },
  };
}

/* ---------------- piezas compartidas ---------------- */

/** Titulo con letras que entran una por una. */
function textoAnimado(texto, clase) {
  const el = nuevo('div', clase);
  const letras = [];
  for (const ch of String(texto)) {
    const s = nuevo('span', 'letra', ch === ' ' ? '&nbsp;' : ch);
    el.appendChild(s);
    letras.push(s);
  }
  return {
    el,
    /** @param {number} p progreso 0..1 de la aparicion completa */
    animar(p, t = 0) {
      const n = letras.length;
      letras.forEach((s, i) => {
        const desde = (i / n) * 0.55;
        const q = tramo(p, desde, desde + 0.45);
        const flote = q >= 1 ? Math.sin(t * 2.4 + i * 0.5) * 5 : 0;
        s.style.opacity = q.toFixed(3);
        s.style.transform = `translateY(${((1 - rebotePop(q || 0.0001)) * 70 + flote).toFixed(2)}px) scale(${(0.5 + rebotePop(q || 0.0001) * 0.5).toFixed(3)})`;
      });
    },
  };
}

function montarMascota(escala = 1) {
  const el = nuevo('div', 'mascota', mascotaSVG());
  // 580px es el ancho de referencia del SVG (incluye el espacio de los brazos).
  el.style.width = `${580 * escala}px`;
  return el;
}

/** Confeti deterministico. */
function montarConfeti(semilla, cantidad = 90) {
  const el = nuevo('div', 'confeti');
  const r = azar(semilla);
  const paleta = ['#E63946', '#FFC93C', '#49B265', '#1D7FE0', '#FF7EB6', '#9B5DE5', '#FF8A3D'];
  const piezas = [];
  for (let i = 0; i < cantidad; i++) {
    const p = nuevo('div', 'pieza');
    const ancho = 18 + r() * 16;
    p.style.width = `${ancho}px`;
    p.style.height = `${ancho * (0.4 + r() * 0.6)}px`;
    p.style.background = paleta[Math.floor(r() * paleta.length)];
    p.style.borderRadius = r() > 0.5 ? '50%' : '4px';
    el.appendChild(p);
    piezas.push({ el: p, x: r() * ANCHO, retraso: r() * 1.4, vel: 260 + r() * 220, giro: (r() - 0.5) * 700, bal: 30 + r() * 70, fase: r() * 6.3 });
  }
  return {
    el,
    animar(t) {
      for (const p of piezas) {
        const tt = t - p.retraso;
        if (tt < 0) { p.el.style.opacity = '0'; continue; }
        const y = -120 + tt * p.vel;
        if (y > ALTO + 120) { p.el.style.opacity = '0'; continue; }
        p.el.style.opacity = '1';
        const x = p.x + Math.sin(tt * 1.8 + p.fase) * p.bal;
        p.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(tt * p.giro).toFixed(1)}deg)`;
      }
    },
  };
}

/** Destellos alrededor de un punto. */
function montarDestellos(semilla, cx, cy, radio = 300) {
  const el = nuevo('div', 'destellos');
  const r = azar(semilla);
  const piezas = [];
  for (let i = 0; i < 14; i++) {
    const d = nuevo('div', 'destello', dibujar('estrella', { color: i % 2 ? '#FFD23F' : '#FFF2A8' }));
    const a = (i / 14) * Math.PI * 2 + r();
    const dist = radio * (0.75 + r() * 0.5);
    d.style.width = `${44 + r() * 40}px`;
    el.appendChild(d);
    piezas.push({ el: d, x: cx + Math.cos(a) * dist, y: cy + Math.sin(a) * dist, retraso: r() * 0.5 });
  }
  return {
    el,
    animar(p) {
      for (const d of piezas) {
        const q = tramo(p, d.retraso, d.retraso + 0.55);
        const escala = q < 0.5 ? rebotePop(q / 0.5) : 1 - (q - 0.5) / 0.5;
        d.el.style.opacity = q > 0 && q < 1 ? '1' : '0';
        d.el.style.transform = `translate(${d.x}px,${d.y}px) translate(-50%,-50%) scale(${Math.max(0, escala).toFixed(3)}) rotate(${(q * 180).toFixed(1)}deg)`;
      }
    },
  };
}

/* ---------------- plantillas de escena ---------------- */

const PLANTILLAS = {
  /** Portada: titulo grande + mascota saludando. */
  intro(def, ctx) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'pradera');
    raiz.appendChild(fondo.el);

    const titulo = textoAnimado(def.titulo || ctx.guion.titulo || '', 'titulo');
    const sub = textoAnimado(def.subtitulo || '', 'subtitulo');
    const bloque = nuevo('div', 'bloque-titulo');
    bloque.append(titulo.el, sub.el);
    raiz.appendChild(bloque);

    // El confeti va detras de la mascota para no taparle la cara.
    const confeti = montarConfeti(semillaDe('intro' + def.titulo), 60);
    raiz.appendChild(confeti.el);

    const mascota = montarMascota(1.15);
    mascota.classList.add('mascota-intro');
    raiz.appendChild(mascota);

    return {
      el: raiz,
      animar(tl, dur) {
        fondo.animar(tl);
        titulo.animar(tramo(tl, 0.3, 1.9), tl);
        sub.animar(tramo(tl, 1.4, 2.6), tl);
        confeti.animar(tl);

        const entrada = rebotePop(tramo(tl, 0.15, 1.1));
        const salida = 1 - tramo(tl, dur - 0.4, dur);
        const brinco = Math.abs(Math.sin(tl * 2.1)) * 26;
        mascota.style.opacity = salida.toFixed(3);
        mascota.style.transform =
          `translate(${(-40 + (1 - entrada) * -420).toFixed(1)}px,${(-brinco).toFixed(1)}px) scale(${(0.85 + entrada * 0.15).toFixed(3)})`;
        animarMascota(mascota, {
          rebote: Math.sin(tl * 4.2) * 0.5 + 0.5,
          saludo: tramo(tl, 0.8, 1.2) * (Math.sin(tl * 7) * 0.5 + 0.5),
          parpadeo: parpadeoEn(tl),
          habla: bocaEn(tl, !!def.narracion),
          inclinacion: vaiven(tl, 3) * 0.4,
        });
      },
    };
  },

  /** Muestra un objeto y dice su nombre. Es la escena base del canal. */
  presentar(def, ctx) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'pradera');
    raiz.appendChild(fondo.el);

    const marco = nuevo('div', 'marco-objeto');
    const objeto = nuevo('div', 'objeto', dibujar(def.objeto, def.color ? { color: resolverColor(def.color) } : {}));
    marco.appendChild(objeto);
    raiz.appendChild(marco);

    // La palabra va dentro de una pastilla blanca: siempre legible, sin importar
    // el fondo, y con el aire de una tarjeta didactica.
    // Si el guion trae `etiquetaEn`, debajo aparece la palabra en ingles.
    const pastilla = nuevo('div', 'pastilla');
    const etiqueta = textoAnimado((def.etiqueta ?? def.objeto).toUpperCase(), 'etiqueta');
    if (def.color) etiqueta.el.style.color = resolverColor(def.color);
    pastilla.appendChild(etiqueta.el);

    const etiquetaEn = def.etiquetaEn
      ? textoAnimado(def.etiquetaEn.toUpperCase(), 'etiqueta-en')
      : null;
    if (etiquetaEn) pastilla.appendChild(etiquetaEn.el);
    raiz.appendChild(pastilla);

    const eco = def.sonido ?? SONIDOS[String(def.objeto).split(':')[0]] ?? '';
    const burbuja = eco ? textoAnimado(eco, 'burbuja') : null;
    if (burbuja) raiz.appendChild(burbuja.el);

    const mascota = montarMascota(0.8);
    mascota.classList.add('mascota-lado');
    raiz.appendChild(mascota);

    const destellos = montarDestellos(semillaDe('p' + def.objeto), ANCHO / 2, 470, 330);
    raiz.appendChild(destellos.el);

    return {
      el: raiz,
      animar(tl, dur) {
        fondo.animar(tl);
        const entra = rebotePop(tramo(tl, 0.1, 0.95));
        const late = 1 + Math.sin(tl * 2.6) * 0.022;
        const sale = 1 - tramo(tl, dur - 0.35, dur) * 0.25;
        marco.style.opacity = tramo(tl, 0.1, 0.5).toFixed(3);
        marco.style.transform =
          `translate(-50%,-50%) scale(${(entra * late * sale).toFixed(4)}) rotate(${(vaiven(tl, 3.6) * 2.2).toFixed(2)}deg)`;

        const pe = tramo(tl, 0.85, 1.45);
        pastilla.style.opacity = pe.toFixed(3);
        pastilla.style.transform = `translateX(-50%) scale(${rebotePop(pe || 0.0001).toFixed(3)})`;
        etiqueta.animar(tramo(tl, 1.05, 2.15), tl);
        // El ingles entra despues, cuando la palabra en espanol ya se dijo.
        if (etiquetaEn) etiquetaEn.animar(tramo(tl, Math.min(2.8, dur * 0.4), Math.min(3.8, dur * 0.55)), tl);
        destellos.animar(tramo(tl, 0.5, 1.8));
        if (burbuja) {
          const p = tramo(tl, Math.min(2.4, dur * 0.45), Math.min(3.2, dur * 0.6));
          burbuja.animar(p, tl);
          burbuja.el.style.opacity = (p > 0 ? 1 - tramo(tl, dur - 0.5, dur) : 0).toFixed(3);
        }

        mascota.style.transform = `translateY(${(-Math.abs(Math.sin(tl * 1.9)) * 14).toFixed(1)}px) scale(${rebotePop(tramo(tl, 0.3, 1.2)).toFixed(3)})`;
        animarMascota(mascota, {
          rebote: Math.sin(tl * 3.8) * 0.5 + 0.5,
          saludo: tramo(tl, 1.0, 1.6) * 0.7,
          parpadeo: parpadeoEn(tl, 0.7),
          habla: bocaEn(tl, !!def.narracion),
          inclinacion: vaiven(tl, 4) * 0.3,
        });
      },
    };
  },

  /** Cuenta objetos uno por uno mostrando el numero. */
  contar(def) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'cielo');
    raiz.appendChild(fondo.el);

    const total = Math.max(1, Math.min(10, def.hasta || 3));
    const fila = nuevo('div', 'fila-objetos');
    const items = [];
    for (let i = 0; i < total; i++) {
      const c = nuevo('div', 'item', dibujar(def.objeto, def.color ? { color: resolverColor(def.color) } : {}));
      // Los objetos ocupan todo el ancho util: cuantos menos hay, mas grandes.
      c.style.width = `${Math.min(360, 1580 / total)}px`;
      fila.appendChild(c);
      items.push(c);
    }
    raiz.appendChild(fila);

    // El numero y su palabra van en una misma fila, no apilados: en 1080p no
    // hay altura para poner los objetos, el numero grande y la pastilla debajo.
    const fila2 = nuevo('div', 'fila-numero');
    const numero = nuevo('div', 'numero-grande', '');
    fila2.appendChild(numero);

    let pastilla = null, palabra = null, palabraEn = null;
    if (def.palabra) {
      pastilla = nuevo('div', 'pastilla');
      palabra = textoAnimado(def.palabra.toUpperCase(), 'etiqueta');
      pastilla.appendChild(palabra.el);
      if (def.palabraEn) {
        palabraEn = textoAnimado(def.palabraEn.toUpperCase(), 'etiqueta-en');
        pastilla.appendChild(palabraEn.el);
      }
      fila2.appendChild(pastilla);
    }
    raiz.appendChild(fila2);

    const mascota = montarMascota(0.7);
    mascota.classList.add('mascota-lado');
    raiz.appendChild(mascota);

    return {
      el: raiz,
      animar(tl, dur) {
        fondo.animar(tl);
        const arranque = 0.7;
        // Un objeto cada ~1,2 s: suficiente para seguir el conteo sin aburrir,
        // reservando el final de la escena para mostrar la palabra del numero.
        const paso = Math.min(1.6, Math.max(0.9, (dur - arranque - 3.5) / total));
        let visibles = 0;
        items.forEach((c, i) => {
          const t0 = arranque + i * paso;
          const q = tramo(tl, t0, t0 + 0.45);
          if (q > 0.5) visibles = i + 1;
          const flote = q >= 1 ? Math.sin(tl * 2.5 + i) * 8 : 0;
          c.style.opacity = q.toFixed(3);
          c.style.transform = `translateY(${((1 - rebotePop(q || 0.0001)) * 90 + flote).toFixed(2)}px) scale(${rebotePop(q || 0.0001).toFixed(3)})`;
        });
        numero.textContent = visibles > 0 ? String(visibles) : '';
        const tNum = arranque + (visibles - 1) * paso;
        const pulso = visibles > 0 ? rebotePop(tramo(tl, tNum, tNum + 0.4)) : 0;
        numero.style.transform = `scale(${(0.8 + pulso * 0.35).toFixed(3)})`;
        numero.style.opacity = visibles > 0 ? '1' : '0';

        // La palabra aparece cuando ya se contaron todos los objetos.
        if (pastilla) {
          const tFin = arranque + total * paso;
          const pp = tramo(tl, tFin, tFin + 0.5);
          pastilla.style.opacity = pp.toFixed(3);
          pastilla.style.transform = `scale(${rebotePop(pp || 0.0001).toFixed(3)})`;
          palabra.animar(tramo(tl, tFin + 0.1, tFin + 0.9), tl);
          if (palabraEn) palabraEn.animar(tramo(tl, tFin + 0.9, tFin + 1.7), tl);
        }

        animarMascota(mascota, {
          rebote: Math.sin(tl * 4) * 0.5 + 0.5,
          saludo: 0.3,
          parpadeo: parpadeoEn(tl, 1.3),
          habla: bocaEn(tl, !!def.narracion),
          inclinacion: vaiven(tl, 3.4) * 0.3,
        });
      },
    };
  },

  /** Pregunta con opciones: pausa, luego marca la respuesta correcta. */
  pregunta(def) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'arcoiris');
    raiz.appendChild(fondo.el);

    const enunciado = textoAnimado(def.enunciado || '', 'enunciado');
    raiz.appendChild(enunciado.el);

    const opciones = (def.opciones || []).slice(0, 3);
    const fila = nuevo('div', 'fila-opciones');
    const tarjetas = opciones.map((op) => {
      const nombre = typeof op === 'string' ? op : op.objeto;
      const t = nuevo('div', 'tarjeta');
      t.appendChild(nuevo('div', 'objeto', dibujar(nombre, typeof op === 'object' && op.color ? { color: resolverColor(op.color) } : {})));
      fila.appendChild(t);
      return t;
    });
    raiz.appendChild(fila);

    const iCorrecta = Math.max(0, def.correcta ?? 0);
    const destellos = montarDestellos(semillaDe('q' + def.enunciado), 0, 0, 240);
    raiz.appendChild(destellos.el);

    return {
      el: raiz,
      animar(tl, dur) {
        fondo.animar(tl);
        enunciado.animar(tramo(tl, 0.2, 1.4), tl);

        // revelarEn menor o igual a 1 se interpreta como fraccion de la escena,
        // para que la respuesta siga cuadrando si la narracion estira la duracion.
        const tRevela = def.revelarEn == null
          ? Math.max(2.6, dur - 3.2)
          : def.revelarEn <= 1 ? def.revelarEn * dur : def.revelarEn;
        tarjetas.forEach((t, i) => {
          const t0 = 1.0 + i * 0.32;
          const q = rebotePop(tramo(tl, t0, t0 + 0.5));
          const esperando = tl < tRevela;
          const salto = esperando ? Math.abs(Math.sin(tl * 2 + i * 1.1)) * 12 : 0;
          let escala = q, opacidad = tramo(tl, t0, t0 + 0.3);
          if (!esperando) {
            const rp = tramo(tl, tRevela, tRevela + 0.45);
            if (i === iCorrecta) escala = q * (1 + rp * 0.22);
            else { escala = q * (1 - rp * 0.18); opacidad *= 1 - rp * 0.6; }
          }
          t.style.opacity = opacidad.toFixed(3);
          t.style.transform = `translateY(${(-salto).toFixed(1)}px) scale(${escala.toFixed(3)})`;
          t.classList.toggle('correcta', !esperando && i === iCorrecta);
        });

        const objetivo = tarjetas[iCorrecta];
        if (objetivo) {
          const [cx, cy] = centroEn(objetivo);
          destellos.el.style.transform = `translate(${cx.toFixed(0)}px,${cy.toFixed(0)}px)`;
        }
        destellos.animar(tramo(tl, tRevela, tRevela + 1.4));
      },
    };
  },

  /** Celebracion corta entre bloques. */
  celebrar(def) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'arcoiris');
    raiz.appendChild(fondo.el);

    const texto = textoAnimado(def.texto || '¡MUY BIEN!', 'titulo');
    const bloque = nuevo('div', 'bloque-titulo');
    bloque.appendChild(texto.el);
    raiz.appendChild(bloque);

    const mascota = montarMascota(1.1);
    mascota.classList.add('mascota-centro');
    raiz.appendChild(mascota);

    const confeti = montarConfeti(semillaDe('c' + (def.texto || '')), 120);
    raiz.appendChild(confeti.el);

    return {
      el: raiz,
      animar(tl) {
        fondo.animar(tl);
        texto.animar(tramo(tl, 0.1, 1.0), tl);
        confeti.animar(tl);
        const salto = Math.abs(Math.sin(tl * 3.4)) * 70;
        mascota.style.transform = `translateX(-50%) translateY(${(-salto).toFixed(1)}px) rotate(${(vaiven(tl, 0.9) * 7).toFixed(2)}deg)`;
        animarMascota(mascota, {
          rebote: Math.sin(tl * 6.8) * 0.5 + 0.5,
          saludo: Math.sin(tl * 9) * 0.5 + 0.5,
          parpadeo: parpadeoEn(tl, 0.2),
          habla: bocaEn(tl, true),
          inclinacion: vaiven(tl, 1.2) * 0.6,
        });
      },
    };
  },

  /** Repaso: rejilla con todo lo aprendido. */
  repaso(def) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'arcoiris');
    raiz.appendChild(fondo.el);

    const titulo = textoAnimado(def.titulo || 'REPASO', 'enunciado');
    raiz.appendChild(titulo.el);

    const items = (def.items || []).slice(0, 8);
    const rejilla = nuevo('div', items.length > 4 ? 'rejilla rejilla-compacta' : 'rejilla');
    const celdas = items.map((it) => {
      const nombre = typeof it === 'string' ? it : it.objeto;
      const etiqueta = typeof it === 'object' ? it.etiqueta : null;
      const celda = nuevo('div', 'celda');
      celda.appendChild(nuevo('div', 'objeto', dibujar(nombre, typeof it === 'object' && it.color ? { color: resolverColor(it.color) } : {})));
      if (etiqueta) {
        const e = nuevo('div', 'celda-etiqueta', String(etiqueta).toUpperCase());
        if (typeof it === 'object' && it.color) e.style.color = resolverColor(it.color);
        celda.appendChild(e);
      }
      if (typeof it === 'object' && it.etiquetaEn) {
        celda.appendChild(nuevo('div', 'celda-etiqueta-en', String(it.etiquetaEn).toUpperCase()));
      }
      rejilla.appendChild(celda);
      return celda;
    });
    raiz.appendChild(rejilla);

    return {
      el: raiz,
      animar(tl, dur) {
        fondo.animar(tl);
        titulo.animar(tramo(tl, 0.1, 1.0), tl);
        const paso = Math.max(0.3, (dur - 1.8) / Math.max(1, celdas.length));
        celdas.forEach((c, i) => {
          const t0 = 0.8 + i * paso;
          const q = rebotePop(tramo(tl, t0, t0 + 0.5));
          c.style.opacity = tramo(tl, t0, t0 + 0.3).toFixed(3);
          c.style.transform = `scale(${q.toFixed(3)}) rotate(${(vaiven(tl + i, 4) * 2).toFixed(2)}deg)`;
        });
      },
    };
  },

  /** Cierre: la mascota se despide. */
  despedida(def, ctx) {
    const raiz = nuevo('div', 'escena');
    const fondo = montarFondo(def.fondo || 'pradera');
    raiz.appendChild(fondo.el);

    const texto = textoAnimado(def.texto || '¡HASTA PRONTO!', 'titulo');
    const bloque = nuevo('div', 'bloque-titulo');
    bloque.appendChild(texto.el);
    if (def.canal || ctx.guion.canal) {
      bloque.appendChild(nuevo('div', 'canal', def.canal || ctx.guion.canal));
    }
    raiz.appendChild(bloque);

    const mascota = montarMascota(1.2);
    mascota.classList.add('mascota-centro');
    raiz.appendChild(mascota);

    return {
      el: raiz,
      animar(tl, dur) {
        fondo.animar(tl);
        texto.animar(tramo(tl, 0.2, 1.3), tl);
        const salida = 1 - tramo(tl, dur - 0.6, dur);
        mascota.style.opacity = salida.toFixed(3);
        mascota.style.transform = `translateX(-50%) translateY(${(-Math.abs(Math.sin(tl * 2)) * 26).toFixed(1)}px) scale(${rebotePop(tramo(tl, 0, 0.9)).toFixed(3)})`;
        animarMascota(mascota, {
          rebote: Math.sin(tl * 4) * 0.5 + 0.5,
          saludo: Math.sin(tl * 8) * 0.5 + 0.5,
          parpadeo: parpadeoEn(tl, 1.1),
          habla: bocaEn(tl, !!def.narracion),
          inclinacion: vaiven(tl, 2) * 0.5,
        });
      },
    };
  },
};

function resolverColor(c) {
  return COLORES[c] ?? c;
}

/**
 * Centro de un elemento en coordenadas del lienzo (1920x1080), sin depender
 * de la escala real del viewport.
 */
function centroEn(el) {
  let x = 0, y = 0, n = el;
  while (n && n.id !== 'lienzo') {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  return [x + el.offsetWidth / 2, y + el.offsetHeight / 2];
}

/* ---------------- montaje y recorrido ---------------- */

let ESCENAS = [];
let DURACION = 0;

/**
 * Construye todo el video en el DOM. Se llama una sola vez.
 * @returns {{duracion:number, escenas:Array}}
 */
export function montar(guion) {
  const lienzo = document.getElementById('lienzo');
  lienzo.innerHTML = '';
  ESCENAS = [];
  let reloj = 0;

  for (const [i, def] of (guion.escenas || []).entries()) {
    const plantilla = PLANTILLAS[def.tipo];
    if (!plantilla) throw new Error(`Tipo de escena desconocido: "${def.tipo}"`);
    const dur = Number(def.duracion) || 5;
    const inst = plantilla(def, { guion, indice: i });
    inst.el.dataset.tipo = def.tipo;
    inst.el.style.display = 'none';
    lienzo.appendChild(inst.el);
    ESCENAS.push({ def, inst, inicio: reloj, fin: reloj + dur, dur });
    reloj += dur;
  }

  DURACION = reloj;
  return {
    duracion: DURACION,
    escenas: ESCENAS.map((e) => ({ tipo: e.def.tipo, inicio: e.inicio, dur: e.dur })),
  };
}

/** Coloca el video en el segundo t. */
export function ir(t) {
  const activa = ESCENAS.find((e) => t >= e.inicio && t < e.fin) || ESCENAS[ESCENAS.length - 1];
  for (const e of ESCENAS) {
    const visible = e === activa;
    if ((e.inst.el.style.display !== 'none') !== visible) {
      e.inst.el.style.display = visible ? 'block' : 'none';
    }
  }
  if (!activa) return;
  const tl = Math.min(t - activa.inicio, activa.dur);
  activa.inst.animar(tl, activa.dur);

  // Transicion suave entre escenas: oscurecimiento corto en los bordes.
  const velo = document.getElementById('velo');
  const entrada = tramo(tl, 0, 0.22);
  const salida = 1 - tramo(tl, activa.dur - 0.22, activa.dur);
  velo.style.opacity = (1 - Math.min(entrada, salida)).toFixed(3);
}

window.__montar = montar;
window.__ir = ir;
window.__listo = true;
