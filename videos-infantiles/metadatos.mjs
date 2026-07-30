#!/usr/bin/env node
/**
 * Genera el texto listo para copiar y pegar al subir cada video a YouTube:
 * título, descripción, etiquetas y la configuración obligatoria.
 *
 * Sale de los propios guiones, así que no se desincroniza del contenido.
 *
 *   node metadatos.mjs                  # todos, a salida/metadatos-youtube.md
 *   node metadatos.mjs --guion guiones/101-colores-compilado.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const valor = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

const unico = valor('guion', null);
const rutas = unico
  ? [path.resolve(RAIZ, unico)]
  : fs.readdirSync(path.join(RAIZ, 'guiones'))
      .filter((f) => /^\d{3}-.*\.json$/.test(f))
      .sort()
      .map((f) => path.join(RAIZ, 'guiones', f));

/** Títulos optimizados para búsqueda, sin caer en clickbait. */
const TITULOS = {
  colores: 'Aprende los COLORES en Español e Inglés 🎨 | Video Educativo para Bebés y Niños de 2 a 4 años',
  formas: 'Aprende las FORMAS en Español e Inglés 🔵🔺 | Figuras Geométricas para Niños de 2 a 4 años',
  numeros: 'Aprende a CONTAR del 1 al 10 en Español e Inglés 🔢 | Números para Niños de 2 a 4 años',
  'frutas-vehiculos': 'FRUTAS y VEHÍCULOS en Español e Inglés 🍎🚗 | Primeras Palabras para Niños de 2 a 4 años',
};

/**
 * Duraciones reales de cada escena. Las del guion son las pedidas; las de
 * verdad salen de tiempos.json, porque cada escena se estira para que quepa su
 * narracion. En un video de 49 minutos ignorar eso corre todos los capitulos.
 */
function duracionesReales(guion) {
  const ruta = path.join(RAIZ, 'temporal', guion.id, 'tiempos.json');
  if (fs.existsSync(ruta)) {
    const t = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (Array.isArray(t.duraciones) && t.duraciones.length === guion.escenas.length) {
      return { duraciones: t.duraciones, medidas: true };
    }
  }
  return { duraciones: guion.escenas.map((e) => Number(e.duracion) || 0), medidas: false };
}

function reloj(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = Math.round(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
    : `${m}:${String(seg).padStart(2, '0')}`;
}

function capitulos(guion, duraciones) {
  // Los capítulos sirven para que un papá salte directo a un color o a un número.
  // Solo se marca la PRIMERA vez que aparece cada concepto: el compilado repite
  // los mismos en cada ronda, y listarlos todos daría noventa entradas iguales.
  // YouTube exige que el primero esté en 0:00 y que haya al menos tres.
  const filas = [];
  const vistos = new Set();
  let t = 0;
  for (const [i, e] of guion.escenas.entries()) {
    const etiqueta = e.etiqueta || e.palabra || (e.tipo === 'intro' ? 'Inicio' : null);
    const clave = etiqueta && String(etiqueta).toLowerCase();
    if (clave && !vistos.has(clave)) {
      vistos.add(clave);
      const nombre = String(etiqueta).charAt(0).toUpperCase() + String(etiqueta).slice(1);
      filas.push(`${filas.length === 0 ? '0:00' : reloj(t)} ${nombre}`);
    }
    t += duraciones[i] || 0;
  }
  return filas;
}

const bloques = [];

for (const ruta of rutas) {
  const guion = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const tema = guion._generado?.tema || guion.id;
  const titulo = TITULOS[tema] || guion.titulo;
  const yt = guion.youtube || {};
  const { duraciones, medidas } = duracionesReales(guion);
  const total = duraciones.reduce((a, b) => a + b, 0);
  const caps = capitulos(guion, duraciones);

  bloques.push(`
## ${guion.id}

**Archivo:** \`salida/${guion.id}.mp4\`
**Miniatura:** \`salida/${guion.id}-miniatura.jpg\`
**Duración:** ${reloj(total)}${medidas ? '' : ' (estimada: falta renderizar)'}  ·  ${guion.escenas.length} escenas

### Título
\`\`\`
${titulo}
\`\`\`

### Descripción
\`\`\`
${yt.descripcion || ''}

Este video está pensado para niños de 2 a 4 años: objetos grandes, colores de
alto contraste, una sola palabra por pantalla y un ritmo pausado, con la palabra
en español y en inglés. La repetición es intencional: a esta edad es lo que
afianza el vocabulario.

${caps.length >= 3 ? 'CAPÍTULOS\n' + caps.slice(0, 30).join('\n') + '\n' : ''}
Canal: ${guion.canal}
Música y animación originales, creadas para este canal.
\`\`\`

### Etiquetas
\`\`\`
${(yt.etiquetas || []).join(', ')}
\`\`\`

### Configuración obligatoria al subir
- **Público:** "Sí, es contenido para niños" (obligatorio por COPPA).
  YouTube desactiva entonces comentarios, pantallas finales, tarjetas y
  anuncios personalizados — es esperado, no es un error.
- **Categoría:** Educación
- **Idioma del video:** Español · Contiene también vocabulario en inglés
- **Subtítulos:** conviene subir los del guion; el texto de la narración está en
  el campo \`narracion\` de \`guiones/${guion.id}.json\`
`);
}

const salida = `# Metadatos para YouTube

Generado por \`metadatos.mjs\` a partir de los guiones. Si cambia un guion, hay
que volver a correrlo.
${bloques.join('\n---\n')}`;

if (unico) {
  console.log(salida);
} else {
  const destino = path.join(RAIZ, 'salida', 'metadatos-youtube.md');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, salida, 'utf8');
  console.log(`${rutas.length} videos -> ${path.relative(RAIZ, destino)}`);
}
