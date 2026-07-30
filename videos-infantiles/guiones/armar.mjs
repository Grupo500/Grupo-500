#!/usr/bin/env node
/**
 * Arma guiones de compilado (15-30 min) a partir de bloques tematicos.
 *
 * Un compilado de 20 minutos tiene mas de 100 escenas: escribirlas a mano no es
 * practico. Este script las genera con la narracion bilingue ya redactada,
 * respetando la concordancia de genero en espanol.
 *
 * La estructura por ronda es: presentar -> presentar -> pregunta, y cada ronda
 * rota los objetos para que la repeticion (que a esta edad es deseable) no sea
 * literalmente la misma escena dos veces.
 *
 * Uso:
 *   node guiones/armar.mjs --tema colores --minutos 20
 *   node guiones/armar.mjs --tema numeros --minutos 18 --salida guiones/mi-video.json
 *   node guiones/armar.mjs --todos --minutos 20
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ============================ datos de contenido ============================ */

// g: genero gramatical. n: nombre con articulo. en: palabra en ingles.
const COLORES = [
  {
    es: 'rojo', esF: 'roja', en: 'red', clave: 'rojo',
    objetos: [
      { o: 'manzana', n: 'una manzana', d: 'la manzana', g: 'f', en: 'apple' },
      { o: 'fresa', n: 'una fresa', d: 'la fresa', g: 'f', en: 'strawberry' },
      { o: 'corazon:rojo', n: 'un corazón', d: 'el corazón', g: 'm', en: 'heart' },
      { o: 'carro:rojo', n: 'un carro', d: 'el carro', g: 'm', en: 'car' },
      { o: 'pelota:rojo', n: 'una pelota', d: 'la pelota', g: 'f', en: 'ball' },
    ],
  },
  {
    es: 'amarillo', esF: 'amarilla', en: 'yellow', clave: 'amarillo',
    objetos: [
      { o: 'sol', n: 'el sol', d: 'el sol', g: 'm', en: 'sun' },
      { o: 'banano', n: 'un banano', d: 'el banano', g: 'm', en: 'banana' },
      { o: 'estrella:amarillo', n: 'una estrella', d: 'la estrella', g: 'f', en: 'star' },
      { o: 'pato', n: 'un pato', d: 'el pato', g: 'm', en: 'duck' },
      { o: 'bus:amarillo', n: 'un bus', d: 'el bus', g: 'm', en: 'bus' },
    ],
  },
  {
    es: 'azul', esF: 'azul', en: 'blue', clave: 'azul',
    objetos: [
      { o: 'pelota:azul', n: 'una pelota', d: 'la pelota', g: 'f', en: 'ball' },
      { o: 'pez:azul', n: 'un pez', d: 'el pez', g: 'm', en: 'fish' },
      { o: 'globo:azul', n: 'un globo', d: 'el globo', g: 'm', en: 'balloon' },
      { o: 'circulo:azul', n: 'un círculo', d: 'el círculo', g: 'm', en: 'circle' },
      { o: 'carro:azul', n: 'un carro', d: 'el carro', g: 'm', en: 'car' },
    ],
  },
  {
    es: 'verde', esF: 'verde', en: 'green', clave: 'verde',
    objetos: [
      { o: 'arbol', n: 'un árbol', d: 'el árbol', g: 'm', en: 'tree' },
      { o: 'rana', n: 'una rana', d: 'la rana', g: 'f', en: 'frog' },
      { o: 'cuadrado:verde', n: 'un cuadrado', d: 'el cuadrado', g: 'm', en: 'square' },
      { o: 'tren:verde', n: 'un tren', d: 'el tren', g: 'm', en: 'train' },
      { o: 'pelota:verde', n: 'una pelota', d: 'la pelota', g: 'f', en: 'ball' },
    ],
  },
  {
    es: 'naranja', esF: 'naranja', en: 'orange', clave: 'naranja',
    objetos: [
      { o: 'naranja', n: 'una naranja', d: 'la naranja', g: 'f', en: 'orange' },
      { o: 'globo:naranja', n: 'un globo', d: 'el globo', g: 'm', en: 'balloon' },
      { o: 'flor:naranja', n: 'una flor', d: 'la flor', g: 'f', en: 'flower' },
      { o: 'ovalo:naranja', n: 'un óvalo', d: 'el óvalo', g: 'm', en: 'oval' },
      { o: 'pelota:naranja', n: 'una pelota', d: 'la pelota', g: 'f', en: 'ball' },
    ],
  },
  {
    es: 'morado', esF: 'morada', en: 'purple', clave: 'morado',
    objetos: [
      { o: 'uva', n: 'unas uvas', d: 'las uvas', g: 'f', pl: true, en: 'grapes' },
      { o: 'globo:morado', n: 'un globo', d: 'el globo', g: 'm', en: 'balloon' },
      { o: 'rombo:morado', n: 'un rombo', d: 'el rombo', g: 'm', en: 'diamond' },
      { o: 'flor:morado', n: 'una flor', d: 'la flor', g: 'f', en: 'flower' },
      { o: 'estrella:morado', n: 'una estrella', d: 'la estrella', g: 'f', en: 'star' },
    ],
  },
  {
    es: 'rosado', esF: 'rosada', en: 'pink', clave: 'rosado',
    objetos: [
      { o: 'flor', n: 'una flor', d: 'la flor', g: 'f', en: 'flower' },
      { o: 'cerdo', n: 'un cerdito', d: 'el cerdito', g: 'm', en: 'pig' },
      { o: 'corazon:rosado', n: 'un corazón', d: 'el corazón', g: 'm', en: 'heart' },
      { o: 'globo:rosado', n: 'un globo', d: 'el globo', g: 'm', en: 'balloon' },
      { o: 'pelota:rosado', n: 'una pelota', d: 'la pelota', g: 'f', en: 'ball' },
    ],
  },
];

const FORMAS = [
  { o: 'circulo', es: 'círculo', en: 'circle', art: 'un', pista: 'es redondo como una pelota' },
  { o: 'cuadrado', es: 'cuadrado', en: 'square', art: 'un', pista: 'tiene cuatro lados iguales' },
  { o: 'triangulo', es: 'triángulo', en: 'triangle', art: 'un', pista: 'tiene tres puntas' },
  { o: 'estrella', es: 'estrella', en: 'star', art: 'una', pista: 'brilla en el cielo' },
  { o: 'corazon', es: 'corazón', en: 'heart', art: 'un', pista: 'es para dar amor' },
  { o: 'rombo', es: 'rombo', en: 'diamond', art: 'un', pista: 'parece una cometa' },
  { o: 'rectangulo', es: 'rectángulo', en: 'rectangle', art: 'un', pista: 'es como una puerta' },
  { o: 'ovalo', es: 'óvalo', en: 'oval', art: 'un', pista: 'es como un huevo' },
];

const NUMEROS = [
  { n: 1, es: 'uno', en: 'one' }, { n: 2, es: 'dos', en: 'two' },
  { n: 3, es: 'tres', en: 'three' }, { n: 4, es: 'cuatro', en: 'four' },
  { n: 5, es: 'cinco', en: 'five' }, { n: 6, es: 'seis', en: 'six' },
  { n: 7, es: 'siete', en: 'seven' }, { n: 8, es: 'ocho', en: 'eight' },
  { n: 9, es: 'nueve', en: 'nine' }, { n: 10, es: 'diez', en: 'ten' },
];

// Objetos que se usan para contar. Hacen falta singular y plural en los dos
// idiomas, y el artículo español, porque "¡Uno manzanas!" no se puede publicar
// en un video que enseña a hablar.
const CONTABLES = [
  { o: 'manzana', art: 'una', sing: 'manzana', pl: 'manzanas', singEn: 'apple', plEn: 'apples' },
  { o: 'pelota:rojo', art: 'una', sing: 'pelota', pl: 'pelotas', singEn: 'ball', plEn: 'balls' },
  { o: 'estrella:amarillo', art: 'una', sing: 'estrella', pl: 'estrellas', singEn: 'star', plEn: 'stars' },
  { o: 'flor', art: 'una', sing: 'flor', pl: 'flores', singEn: 'flower', plEn: 'flowers' },
  { o: 'globo:azul', art: 'un', sing: 'globo', pl: 'globos', singEn: 'balloon', plEn: 'balloons' },
  { o: 'pez:naranja', art: 'un', sing: 'pez', pl: 'peces', singEn: 'fish', plEn: 'fish' },
  { o: 'fresa', art: 'una', sing: 'fresa', pl: 'fresas', singEn: 'strawberry', plEn: 'strawberries' },
  { o: 'naranja', art: 'una', sing: 'naranja', pl: 'naranjas', singEn: 'orange', plEn: 'oranges' },
  { o: 'corazon:rosado', art: 'un', sing: 'corazón', pl: 'corazones', singEn: 'heart', plEn: 'hearts' },
  { o: 'banano', art: 'un', sing: 'banano', pl: 'bananos', singEn: 'banana', plEn: 'bananas' },
];

const FRUTAS = [
  { o: 'manzana', es: 'manzana', en: 'apple', art: 'una', d: 'la manzana', sabor: 'dulce' },
  { o: 'banano', es: 'banano', en: 'banana', art: 'un', d: 'el banano', sabor: 'suave' },
  { o: 'uva', es: 'uvas', en: 'grapes', art: 'unas', d: 'las uvas', sabor: 'dulces', pl: true },
  { o: 'naranja', es: 'naranja', en: 'orange', art: 'una', d: 'la naranja', sabor: 'jugosa' },
  { o: 'sandia', es: 'sandía', en: 'watermelon', art: 'una', d: 'la sandía', sabor: 'fresca' },
  { o: 'fresa', es: 'fresa', en: 'strawberry', art: 'una', d: 'la fresa', sabor: 'dulce' },
];

const VEHICULOS = [
  { o: 'carro', es: 'carro', en: 'car', art: 'un', d: 'el carro', sonido: '¡BRUM BRUM!' },
  { o: 'bus', es: 'bus', en: 'bus', art: 'un', d: 'el bus', sonido: '¡PIII PIII!' },
  { o: 'avion', es: 'avión', en: 'airplane', art: 'un', d: 'el avión', sonido: '¡FIUUUM!' },
  { o: 'barco', es: 'barco', en: 'boat', art: 'un', d: 'el barco', sonido: '¡TUUU TUUU!' },
  { o: 'tren', es: 'tren', en: 'train', art: 'un', d: 'el tren', sonido: '¡CHU CHU!' },
];

/* ============================== utilidades ================================= */

/** Rota un arreglo n posiciones: sirve para variar las rondas. */
const rotar = (arr, n) => arr.map((_, i) => arr[(i + n) % arr.length]);

/**
 * Concordancia de un adjetivo español en género y número.
 *   concordar('rojo', 'f', false) -> 'roja'
 *   concordar('azul', 'm', true)  -> 'azules'
 * Es imprescindible: el video enseña idioma, y "las uvas es morada" no se puede
 * publicar.
 */
function concordar(base, genero, plural) {
  let s = base;
  if (base.endsWith('o')) s = genero === 'f' ? `${base.slice(0, -1)}a` : base;
  if (!plural) return s;
  return /[aeiou]$/.test(s) ? `${s}s` : `${s}es`;
}

/** "es" o "son" según el número del sujeto. */
const serEs = (plural) => (plural ? 'son' : 'es');

/**
 * Artículo indefinido inglés. Depende de la palabra que sigue, no del sustantivo:
 * "a red apple" pero "an orange ball". Los plurales no llevan artículo.
 */
function artEn(siguiente, plural = false) {
  if (plural) return '';
  return /^[aeiou]/i.test(siguiente) ? 'an ' : 'a ';
}

/** "This is" / "These are" según el número. */
const esteEn = (plural) => (plural ? 'These are' : 'This is');

function narrar(es, en) {
  return [{ idioma: 'es', texto: es }, { idioma: 'en', texto: en }];
}

const CELEBRACIONES = [
  { texto: '¡MUY BIEN!', es: '¡Lo lograste! ¡Muy bien!', en: 'Great job!' },
  { texto: '¡EXCELENTE!', es: '¡Excelente! Sigue así.', en: 'Excellent!' },
  { texto: '¡BRAVO!', es: '¡Bravo! Qué bien lo haces.', en: 'Bravo!' },
  { texto: '¡SÍ!', es: '¡Sí! Esa era la respuesta.', en: 'Yes! That is right.' },
];

/* ============================== constructores =============================== */

/** Escena de pregunta: 3 opciones, una correcta. */
function pregunta(enunciado, opciones, correcta, narracionEs, narracionEn) {
  return {
    tipo: 'pregunta', duracion: 11, enunciado,
    opciones, correcta,
    revelarEn: 0.62, // fraccion de la escena: se ajusta si la narracion es larga
    narracion: narrar(narracionEs, narracionEn),
  };
}

function armarColores(ronda) {
  const escenas = [];
  const colores = rotar(COLORES, ronda);

  for (const [i, c] of colores.entries()) {
    const adj = (obj) => concordar(c.es, obj.g, !!obj.pl);
    // Dos objetos por color en cada ronda, rotando el punto de partida.
    const objetos = [0, 1].map((k) => c.objetos[(ronda * 2 + k) % c.objetos.length]);

    for (const obj of objetos) {
      escenas.push({
        tipo: 'presentar', duracion: 9,
        objeto: obj.o, etiqueta: c.es, etiquetaEn: c.en, color: c.clave,
        narracion: narrar(
          `Mira. ${cap(obj.n)}. ${cap(obj.d)} ${serEs(obj.pl)} ${adj(obj)}. ${cap(c.es)}.`,
          // Se arma la frase y se capitaliza al final: con plural no hay
          // articulo, y capitalizar el articulo dejaria la frase en minuscula.
          `${cap(c.en)}. ${cap(`${artEn(c.en, obj.pl)}${c.en} ${obj.en}`)}.`
        ),
      });
    }

    // La opcion correcta va acompanada de dos distractores de otros colores.
    const otros = colores.filter((x) => x.es !== c.es);
    const d1 = otros[(ronda + 1) % otros.length];
    const d2 = otros[(ronda + 3) % otros.length];
    const correcto = objetos[0];
    const opciones = [
      { objeto: d1.objetos[ronda % d1.objetos.length].o },
      { objeto: correcto.o },
      { objeto: d2.objetos[(ronda + 2) % d2.objetos.length].o },
    ];
    escenas.push(pregunta(
      `¿CUÁL ES ${c.es.toUpperCase()}?`, opciones, 1,
      `¿Cuál de estos es ${c.es}? Piénsalo. ¡Muy bien! ${cap(correcto.d)} ${serEs(correcto.pl)} ${adj(correcto)}.`,
      `Which one is ${c.en}? Yes! The ${correcto.en} ${correcto.pl ? 'are' : 'is'} ${c.en}.`
    ));

    if (i % 3 === 2) {
      const cel = CELEBRACIONES[(ronda + i) % CELEBRACIONES.length];
      escenas.push({ tipo: 'celebrar', duracion: 5, texto: cel.texto, narracion: narrar(cel.es, cel.en) });
    }
  }
  return escenas;
}


function armarFormas(ronda) {
  const escenas = [];
  const formas = rotar(FORMAS, ronda);
  const paleta = ['azul', 'rojo', 'amarillo', 'verde', 'morado', 'naranja', 'rosado'];

  for (const [i, f] of formas.entries()) {
    const color = paleta[(ronda + i) % paleta.length];
    escenas.push({
      tipo: 'presentar', duracion: 9,
      objeto: `${f.o}:${color}`, etiqueta: f.es, etiquetaEn: f.en, color,
      narracion: narrar(
        `Esta figura es ${f.art} ${f.es}. ${cap(f.es)}. ${cap(f.pista)}.`,
        `${cap(f.en)}. This is ${artEn(f.en)}${f.en}.`
      ),
    });

    const otras = formas.filter((x) => x.o !== f.o);
    const fem = f.art === 'una';
    escenas.push(pregunta(
      `¿CUÁL ES ${fem ? 'LA' : 'EL'} ${f.es.toUpperCase()}?`,
      [
        { objeto: `${otras[(ronda + 1) % otras.length].o}:${paleta[(i + 1) % paleta.length]}` },
        { objeto: `${f.o}:${color}` },
        { objeto: `${otras[(ronda + 4) % otras.length].o}:${paleta[(i + 3) % paleta.length]}` },
      ], 1,
      `¿Cuál de estas figuras es ${f.art} ${f.es}? Piénsalo. ¡Muy bien! ${fem ? 'Esa' : 'Ese'} es ${f.art} ${f.es}.`,
      `Which one is the ${f.en}? Yes! That is ${artEn(f.en)}${f.en}.`
    ));

    if (i % 3 === 2) {
      const cel = CELEBRACIONES[(ronda + i) % CELEBRACIONES.length];
      escenas.push({ tipo: 'celebrar', duracion: 5, texto: cel.texto, narracion: narrar(cel.es, cel.en) });
    }
  }
  return escenas;
}

function armarNumeros(ronda) {
  const escenas = [];
  for (const [i, num] of NUMEROS.entries()) {
    const c = CONTABLES[(ronda * 3 + i) % CONTABLES.length];
    // Contar despacio: mas objetos, mas tiempo.
    const duracion = 8 + num.n * 1.1;
    // Con uno va el artículo y el singular ("¡Una manzana!"); de dos en adelante,
    // el numeral y el plural ("¡Tres manzanas!").
    const cuentaEs = NUMEROS.slice(0, num.n).map((x) => cap(x.es)).join('. ');
    const cuentaEn = NUMEROS.slice(0, num.n).map((x) => cap(x.en)).join(', ');
    const totalEs = num.n === 1 ? `${cap(c.art)} ${c.sing}` : `${cap(num.es)} ${c.pl}`;
    const totalEn = num.n === 1 ? `One ${c.singEn}` : `${cap(num.en)} ${c.plEn}`;

    escenas.push({
      tipo: 'contar', duracion: Math.round(duracion),
      objeto: c.o, hasta: num.n,
      palabra: num.es, palabraEn: num.en,
      // Cada segmento se queda en su idioma: la palabra en el otro idioma ya
      // aparece en pantalla, y meterla en el audio la hace sonar mal.
      narracion: narrar(
        `Vamos a contar. ${cuentaEs}. ¡${totalEs}! ${cap(num.es)}.`,
        `Let's count. ${cuentaEn}. ${totalEn}. ${cap(num.en)}.`
      ),
    });

    if (i % 4 === 3) {
      const cel = CELEBRACIONES[(ronda + i) % CELEBRACIONES.length];
      escenas.push({ tipo: 'celebrar', duracion: 5, texto: cel.texto, narracion: narrar(cel.es, cel.en) });
    }
  }
  return escenas;
}

function armarFrutasVehiculos(ronda) {
  const escenas = [];
  const frutas = rotar(FRUTAS, ronda);
  const vehiculos = rotar(VEHICULOS, ronda);

  for (const [i, f] of frutas.entries()) {
    escenas.push({
      tipo: 'presentar', duracion: 9,
      objeto: f.o, etiqueta: f.es, etiquetaEn: f.en,
      narracion: narrar(
        `Mira. ${cap(f.art)} ${f.es}. ${cap(f.d)} ${serEs(f.pl)} ${f.sabor}. ${cap(f.es)}.`,
        `${cap(f.en)}. ${esteEn(f.pl)} ${artEn(f.en, f.pl)}${f.en}.`
      ),
    });
    if (i % 3 === 2) {
      const otras = frutas.filter((x) => x.o !== f.o);
      escenas.push(pregunta(
        `¿DÓNDE ${f.pl ? 'ESTÁN' : 'ESTÁ'} ${f.d.toUpperCase()}?`,
        [{ objeto: otras[0].o }, { objeto: f.o }, { objeto: otras[2].o }], 1,
        `¿Dónde ${f.pl ? 'están' : 'está'} ${f.d}? Piénsalo. ¡Muy bien! Ahí ${f.pl ? 'están' : 'está'}.`,
        `Where ${f.pl ? 'are' : 'is'} the ${f.en}? Yes! There ${f.pl ? 'they are' : 'it is'}.`
      ));
    }
  }

  const cel = CELEBRACIONES[ronda % CELEBRACIONES.length];
  escenas.push({ tipo: 'celebrar', duracion: 5, texto: cel.texto, narracion: narrar(cel.es, cel.en) });

  for (const [i, v] of vehiculos.entries()) {
    escenas.push({
      tipo: 'presentar', duracion: 9,
      objeto: v.o, etiqueta: v.es, etiquetaEn: v.en, sonido: v.sonido,
      narracion: narrar(
        `Mira. ${cap(v.art)} ${v.es}. ${cap(v.d)} hace ${v.sonido.replace(/[¡!]/g, '')}. ${cap(v.es)}.`,
        `${cap(v.en)}. This is ${artEn(v.en)}${v.en}.`
      ),
    });
    if (i % 3 === 2) {
      const otros = vehiculos.filter((x) => x.o !== v.o);
      escenas.push(pregunta(
        `¿CUÁL ES ${v.d.toUpperCase()}?`,
        [{ objeto: otros[1].o }, { objeto: v.o }, { objeto: otros[3].o }], 1,
        `¿Cuál es ${v.d}? Piénsalo. ¡Muy bien! Ese es ${v.art} ${v.es}.`,
        `Which one is the ${v.en}? Yes! That is the ${v.en}.`
      ));
    }
  }
  return escenas;
}

/* ================================= temas =================================== */

const TEMAS = {
  colores: {
    titulo: 'LOS COLORES', subtitulo: 'en español e inglés',
    ronda: armarColores,
    repaso: {
      titulo: 'LOS COLORES QUE APRENDIMOS',
      items: COLORES.slice(0, 8).map((c) => ({
        objeto: c.objetos[0].o, etiqueta: c.es, etiquetaEn: c.en, color: c.clave,
      })),
      narracionEs: 'Repasemos: ' + COLORES.map((c) => c.es).join(', ') + '.',
      narracionEn: 'Let us review: ' + COLORES.map((c) => c.en).join(', ') + '.',
    },
    youtube: {
      etiquetas: ['colores para ninos', 'aprender colores', 'colores en ingles y espanol',
        'videos educativos 2 anos', 'bilingue ninos'],
    },
  },
  formas: {
    titulo: 'LAS FORMAS', subtitulo: 'en español e inglés',
    ronda: armarFormas,
    repaso: {
      titulo: 'LAS FORMAS QUE APRENDIMOS',
      items: FORMAS.map((f, i) => ({
        objeto: `${f.o}:${['azul', 'rojo', 'amarillo', 'verde', 'morado', 'naranja', 'rosado', 'azul'][i]}`,
        etiqueta: f.es, etiquetaEn: f.en,
      })),
      narracionEs: 'Repasemos las formas: ' + FORMAS.map((f) => f.es).join(', ') + '.',
      narracionEn: 'Let us review the shapes: ' + FORMAS.map((f) => f.en).join(', ') + '.',
    },
    youtube: {
      etiquetas: ['formas para ninos', 'figuras geometricas ninos', 'shapes for kids',
        'aprender formas', 'videos educativos 3 anos'],
    },
  },
  numeros: {
    titulo: 'LOS NÚMEROS', subtitulo: 'del 1 al 10',
    ronda: armarNumeros,
    musica: 'juguetona',
    repaso: {
      titulo: 'CONTAMOS HASTA 10',
      items: NUMEROS.slice(0, 8).map((num, i) => ({
        objeto: CONTABLES[i].o, etiqueta: String(num.n), etiquetaEn: num.en,
      })),
      narracionEs: 'Contemos otra vez: ' + NUMEROS.map((n) => n.es).join(', ') + '.',
      narracionEn: 'Let us count again: ' + NUMEROS.map((n) => n.en).join(', ') + '.',
    },
    youtube: {
      etiquetas: ['numeros para ninos', 'contar del 1 al 10', 'numbers for kids',
        'aprender a contar', 'videos educativos 2 anos'],
    },
  },
  'frutas-vehiculos': {
    titulo: 'FRUTAS Y VEHÍCULOS', subtitulo: 'en español e inglés',
    ronda: armarFrutasVehiculos,
    repaso: {
      titulo: 'LO QUE APRENDIMOS',
      items: [...FRUTAS.slice(0, 4), ...VEHICULOS.slice(0, 4)].map((x) => ({
        objeto: x.o, etiqueta: x.es, etiquetaEn: x.en,
      })),
      narracionEs: 'Repasemos: ' + [...FRUTAS, ...VEHICULOS].map((x) => x.es).join(', ') + '.',
      narracionEn: 'Let us review: ' + [...FRUTAS, ...VEHICULOS].map((x) => x.en).join(', ') + '.',
    },
    youtube: {
      etiquetas: ['frutas para ninos', 'vehiculos para ninos', 'fruits for kids',
        'vehicles for kids', 'aprender vocabulario ninos'],
    },
  },
};

/* ================================ armado ================================== */

function armar(nombreTema, minutos, canal, id) {
  const tema = TEMAS[nombreTema];
  if (!tema) throw new Error(`Tema desconocido: ${nombreTema}. Opciones: ${Object.keys(TEMAS).join(', ')}`);

  const objetivo = minutos * 60;

  const intro = {
    tipo: 'intro', duracion: 8, titulo: tema.titulo, subtitulo: tema.subtitulo,
    narracion: narrar(
      `¡Hola amiguitos! Yo soy Lulo. Hoy vamos a aprender ${tema.titulo.toLowerCase()} en español y en inglés. ¿Estás listo?`,
      `Hello friends! I am Lulo. Today we are going to learn. Are you ready?`
    ),
  };
  const repaso = {
    tipo: 'repaso', duracion: 14, titulo: tema.repaso.titulo, items: tema.repaso.items,
    narracion: narrar(tema.repaso.narracionEs, tema.repaso.narracionEn),
  };
  const despedida = {
    tipo: 'despedida', duracion: 7, texto: '¡HASTA PRONTO!', canal,
    narracion: narrar(
      'Gracias por jugar conmigo. Nos vemos en el próximo video. ¡Adiós!',
      'Thank you for playing with me. See you next time. Bye bye!'
    ),
  };

  const fijas = intro.duracion + repaso.duracion + despedida.duracion;
  const escenas = [intro];

  // Se agregan rondas completas hasta acercarse al objetivo. Cada ronda rota
  // los objetos, asi la repeticion refuerza sin volverse identica.
  let acumulado = fijas;
  let ronda = 0;
  const rondas = [];
  while (ronda < 40) {
    const bloque = tema.ronda(ronda);
    const dur = bloque.reduce((s, e) => s + e.duracion, 0);
    // Si agregar la ronda pasa mas de un 12% del objetivo, se corta.
    if (ronda > 0 && acumulado + dur > objetivo * 1.12) break;
    rondas.push(bloque);
    acumulado += dur;
    ronda++;
    if (acumulado >= objetivo) break;
  }

  for (const [i, bloque] of rondas.entries()) {
    escenas.push(...bloque);
    // Repaso intermedio entre rondas, menos al final.
    if (i < rondas.length - 1 && rondas.length > 2) {
      escenas.push({ ...repaso, duracion: 12 });
      acumulado += 12;
    }
  }
  escenas.push(repaso, despedida);

  const total = escenas.reduce((s, e) => s + e.duracion, 0);

  return {
    id,
    titulo: `${tema.titulo} EN ESPAÑOL E INGLÉS`,
    canal,
    edad: '2-4 anos',
    fps: 30,
    musica: { estilo: tema.musica || 'alegre', volumen: 0.3, semilla: 17 },
    youtube: {
      hechoParaNinos: true,
      descripcion:
        `Aprende ${tema.titulo.toLowerCase()} con Lulo, en español y en inglés. `
        + `Video tranquilo y repetitivo, con objetos grandes y palabras claras, `
        + `pensado para niños de 2 a 4 años. ${Math.round(total / 60)} minutos de contenido.`,
      etiquetas: tema.youtube.etiquetas,
    },
    _generado: {
      tema: nombreTema, rondas: rondas.length, escenas: escenas.length,
      duracionEstimada: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`,
      nota: 'Generado por guiones/armar.mjs. La duracion final crece si la narracion es mas larga que lo declarado.',
    },
    escenas,
  };
}

/* ================================== CLI =================================== */

function main() {
  const args = process.argv.slice(2);
  const valor = (nombre, def) => {
    const i = args.indexOf(`--${nombre}`);
    return i >= 0 ? args[i + 1] : def;
  };

  const minutos = Number(valor('minutos', 20));
  const canal = valor('canal', 'Lulo y sus amigos');
  const todos = args.includes('--todos');
  const temas = todos ? Object.keys(TEMAS) : [valor('tema', 'colores')];

  const numeroBase = { colores: 101, formas: 102, numeros: 103, 'frutas-vehiculos': 104 };

  for (const t of temas) {
    const id = valor('id', `${numeroBase[t] ?? 100}-${t}-compilado`);
    const guion = armar(t, minutos, canal, todos ? `${numeroBase[t]}-${t}-compilado` : id);
    const destino = path.join(AQUI, `${guion.id}.json`);
    fs.writeFileSync(destino, JSON.stringify(guion, null, 2) + '\n', 'utf8');
    const g = guion._generado;
    console.log(`${path.basename(destino)}  ->  ${g.escenas} escenas, ${g.rondas} rondas, ~${g.duracionEstimada} min`);
  }
}

main();
