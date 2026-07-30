#!/usr/bin/env node
/**
 * Produce uno o varios videos de punta a punta: narracion y luego render.
 *
 * Es el atajo para no correr voz.py y render.mjs a mano por cada guion.
 * Si un guion falla, sigue con el siguiente y reporta todo al final.
 *
 *   node producir.mjs --motor kokoro                    # todos, voz local y gratis
 *   node producir.mjs --motor kokoro --guion guiones/101-colores-compilado.json
 *   node producir.mjs --sin-voz --escala 0.5            # borradores mudos
 */

import { spawnSync } from 'node:child_process';

import { comandoPython } from './lib/entorno.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const valor = (n, def) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : def;
};
const bandera = (n) => args.includes(`--${n}`);

const unico = valor('guion', null);
const guiones = unico
  ? [path.resolve(RAIZ, unico)]
  : fs.readdirSync(path.join(RAIZ, 'guiones'))
      .filter((f) => /^\d{3}-.*\.json$/.test(f))
      .sort()
      .map((f) => path.join(RAIZ, 'guiones', f));

if (!guiones.length) {
  console.error('No se encontraron guiones en guiones/.');
  process.exit(1);
}

const sinVoz = bandera('sin-voz');
const escala = valor('escala', null);
const crf = valor('crf', null);
// Todo lo relativo a la voz se pasa tal cual a voz.py.
const motor = valor('motor', 'kokoro');
const vozEs = valor('voz-es', null);
const vozEn = valor('voz-en', null);
const velocidad = valor('velocidad', null);

function correr(comando, argumentos, etiqueta) {
  const inicio = Date.now();
  const r = spawnSync(comando, argumentos, { cwd: RAIZ, stdio: 'inherit' });
  const seg = ((Date.now() - inicio) / 1000).toFixed(0);
  if (r.status !== 0) {
    console.error(`\n  ✗ falló ${etiqueta} (código ${r.status})`);
    return false;
  }
  console.log(`  ✓ ${etiqueta} en ${seg}s`);
  return true;
}

const resultados = [];

for (const [i, guion] of guiones.entries()) {
  const nombre = path.basename(guion, '.json');
  console.log(`\n${'═'.repeat(66)}`);
  console.log(`[${i + 1}/${guiones.length}]  ${nombre}`);
  console.log('═'.repeat(66));

  if (!sinVoz) {
    const argsVoz = ['audio/voz.py', '--guion', path.relative(RAIZ, guion), '--motor', motor];
    if (vozEs) argsVoz.push('--voz-es', vozEs);
    if (vozEn) argsVoz.push('--voz-en', vozEn);
    if (velocidad) argsVoz.push('--velocidad', velocidad);
    if (!correr(comandoPython(), argsVoz, `narración (${motor})`)) {
      resultados.push({ nombre, estado: 'falló la narración' });
      continue;
    }
  }

  const argsRender = ['render.mjs', '--guion', path.relative(RAIZ, guion)];
  if (sinVoz) argsRender.push('--sin-voz');
  if (escala) argsRender.push('--escala', escala);
  if (crf) argsRender.push('--crf', crf);

  if (!correr('node', argsRender, 'render')) {
    resultados.push({ nombre, estado: 'falló el render' });
    continue;
  }

  const mp4 = path.join(RAIZ, 'salida', `${nombre}.mp4`);
  const mb = fs.existsSync(mp4) ? (fs.statSync(mp4).size / 1e6).toFixed(1) : '?';
  resultados.push({ nombre, estado: 'listo', mb });
}

console.log(`\n${'═'.repeat(66)}\nRESUMEN\n${'═'.repeat(66)}`);
for (const r of resultados) {
  console.log(`  ${r.estado === 'listo' ? '✓' : '✗'} ${r.nombre.padEnd(34)} ${r.estado}${r.mb ? ` (${r.mb} MB)` : ''}`);
}

const fallos = resultados.filter((r) => r.estado !== 'listo').length;
process.exit(fallos ? 1 : 0);
