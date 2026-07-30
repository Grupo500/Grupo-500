#!/usr/bin/env node
/**
 * Renderizador: guion JSON -> MP4 listo para YouTube.
 *
 * Como funciona:
 *   1. Prepara el audio (musica + narracion) y obtiene los tiempos finales.
 *   2. Levanta un servidor local y abre la escena en Chromium.
 *   3. Pide cuadro por cuadro (__ir(t) + captura) y los envia por tuberia a ffmpeg.
 *   4. ffmpeg codifica H.264 + AAC en un solo paso.
 *
 * Ejemplos:
 *   node render.mjs --guion guiones/001-los-colores.json
 *   node render.mjs --guion guiones/001-los-colores.json --escala 0.5 --crf 28   (borrador)
 *   node render.mjs --guion guiones/001-los-colores.json --foto 12              (una imagen)
 */

import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { candidatosChromium, comandoPython, ffmpegBin } from './lib/entorno.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ANCHO_BASE = 1920;
const ALTO_BASE = 1080;

/* ---------------- argumentos ---------------- */

function leerArgs(argv) {
  const a = {
    guion: null, escala: 1, fps: null, crf: 20, preset: 'medium',
    salida: null, sinAudio: false, sinVoz: false, sinEfectos: false,
    desde: 0, hasta: null, foto: null, fotos: null, calidadCuadro: 96, sinMiniatura: false,
    trabajadores: 0,
  };
  const numeros = new Set(['escala', 'fps', 'crf', 'desde', 'hasta', 'foto', 'calidadCuadro', 'trabajadores']);
  const alias = {
    'sin-audio': 'sinAudio', 'sin-voz': 'sinVoz', 'sin-efectos': 'sinEfectos',
    'calidad-cuadro': 'calidadCuadro', 'sin-miniatura': 'sinMiniatura',
  };
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const bruto = argv[i].slice(2);
    const clave = alias[bruto] ?? bruto;
    if (clave === 'sinAudio' || clave === 'sinVoz' || clave === 'sinMiniatura' || clave === 'sinEfectos') {
      a[clave] = true;
      continue;
    }
    const valor = argv[++i];
    a[clave] = numeros.has(clave) ? Number(valor) : valor;
  }
  if (!a.guion) {
    console.error('Falta --guion <ruta>. Ejemplo:\n  node render.mjs --guion guiones/001-los-colores.json');
    process.exit(1);
  }
  return a;
}

/**
 * Abre Chromium. Si la version de Playwright no trae su navegador descargado,
 * reutiliza uno del sistema en vez de exigir "npx playwright install".
 */
async function abrirNavegador() {
  const opciones = { args: ['--force-color-profile=srgb', '--font-render-hinting=none'] };
  try {
    return await chromium.launch(opciones);
  } catch (e) {
    for (const candidato of candidatosChromium()) {
      if (candidato && fs.existsSync(candidato)) {
        console.log(`  (usando Chromium del sistema: ${candidato})`);
        return chromium.launch({ ...opciones, executablePath: candidato });
      }
    }
    throw e;
  }
}

/* ---------------- servidor local ---------------- */

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg',
};

function resolverRuta(url) {
  const limpia = decodeURIComponent(url.split('?')[0]);
  if (limpia === '/' || limpia === '/index.html') return path.join(RAIZ, 'src/escena.html');
  if (limpia.startsWith('/fuentes/')) {
    const archivo = path.basename(limpia);
    const propia = path.join(RAIZ, 'src/fuentes', archivo);
    if (fs.existsSync(propia)) return propia;
    for (const familia of ['baloo-2', 'nunito']) {
      const p = path.join(RAIZ, 'node_modules/@fontsource', familia, 'files', archivo);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }
  // Todo lo demas sale de src/, sin permitir salir de la carpeta.
  const destino = path.join(RAIZ, 'src', limpia);
  return destino.startsWith(path.join(RAIZ, 'src')) ? destino : null;
}

function levantarServidor() {
  const servidor = http.createServer((req, res) => {
    const ruta = resolverRuta(req.url);
    if (!ruta || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) {
      res.writeHead(404).end('no encontrado');
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
    fs.createReadStream(ruta).pipe(res);
  });
  return new Promise((resolver) => {
    servidor.listen(0, '127.0.0.1', () => resolver({ servidor, puerto: servidor.address().port }));
  });
}

/* ---------------- audio ---------------- */

function prepararAudio(rutaGuion, sinVoz) {
  const args = ['audio/preparar.py', '--guion', rutaGuion];
  if (sinVoz) args.push('--sin-voz');
  try {
    const salida = execFileSync(comandoPython(), args, { cwd: RAIZ, encoding: 'utf8' });
    process.stdout.write(salida);
  } catch (e) {
    console.error('Fallo la preparacion del audio:\n' + (e.stderr || e.message));
    throw e;
  }
}

/* ---------------- render ---------------- */

async function main() {
  const args = leerArgs(process.argv);
  const rutaGuion = path.resolve(RAIZ, args.guion);
  const guion = JSON.parse(fs.readFileSync(rutaGuion, 'utf8'));
  guion.id ||= path.basename(rutaGuion, '.json');

  const fps = args.fps || guion.fps || 30;
  const ancho = Math.round(ANCHO_BASE * args.escala / 2) * 2;
  const alto = Math.round(ALTO_BASE * args.escala / 2) * 2;
  // --foto 12  o  --fotos "0.5,12,48"  para revisar el diseno sin renderizar todo.
  const instantes = args.fotos
    ? String(args.fotos).split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : args.foto != null ? [args.foto] : [];
  const esFoto = instantes.length > 0;

  // 1) Audio y tiempos definitivos.
  let audioWav = null;
  if (!args.sinAudio && !esFoto) {
    prepararAudio(args.guion, args.sinVoz);
    const tiempos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temporal', guion.id, 'tiempos.json'), 'utf8'));
    tiempos.duraciones.forEach((d, i) => { if (guion.escenas[i]) guion.escenas[i].duracion = d; });
    audioWav = path.join(RAIZ, 'temporal', guion.id, 'audio.wav');
  }

  // 2) Navegador.
  const { servidor, puerto } = await levantarServidor();
  const navegador = await abrirNavegador();
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  pagina.on('pageerror', (e) => console.error('Error en la escena:', e.message));

  await pagina.goto(`http://127.0.0.1:${puerto}/`, { waitUntil: 'load' });
  await pagina.waitForFunction('window.__listo === true', null, { timeout: 15000 });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.evaluate((k) => {
    document.getElementById('lienzo').style.transform = `scale(${k})`;
  }, args.escala);

  const info = await pagina.evaluate((g) => window.__montar(g), guion);
  const duracion = info.duracion;

  fs.mkdirSync(path.join(RAIZ, 'salida'), { recursive: true });

  // Los efectos se mezclan despues de montar, porque los tiempos exactos los
  // reporta el motor (que sabe en que segundo aparece cada objeto).
  if (audioWav && !args.sinEfectos && info.eventos?.length) {
    const rutaEventos = path.join(RAIZ, 'temporal', guion.id, 'eventos.json');
    fs.writeFileSync(rutaEventos, JSON.stringify(info.eventos), 'utf8');
    try {
      process.stdout.write(execFileSync(comandoPython(), [
        'audio/efectos.py', '--guion', args.guion, '--eventos', path.relative(RAIZ, rutaEventos),
      ], { cwd: RAIZ, encoding: 'utf8' }));
    } catch (e) {
      console.error('No se pudieron mezclar los efectos:\n' + (e.stderr || e.message));
      throw e;
    }
  }

  // Nivelacion al estandar de YouTube. Va al final, cuando la banda sonora ya
  // tiene voz, musica y efectos: medir antes daria un valor que no corresponde.
  if (audioWav) {
    try {
      process.stdout.write(execFileSync(comandoPython(),
        ['audio/nivelar.py', '--guion', args.guion], { cwd: RAIZ, encoding: 'utf8' }));
    } catch (e) {
      console.error('No se pudo nivelar el audio:\n' + (e.stderr || e.message));
      throw e;
    }
  }

  // Modo foto: una sola imagen para revisar el diseno rapido.
  if (esFoto) {
    for (const t of instantes) {
      const destino = path.join(RAIZ, 'salida', `${guion.id}-t${t}.png`);
      await pagina.evaluate((tt) => window.__ir(tt), t);
      await pagina.screenshot({ path: destino });
      console.log(`foto t=${t}s -> ${path.relative(RAIZ, destino)}`);
    }
    console.log(`(duracion total del guion: ${duracion.toFixed(1)}s)`);
    await navegador.close();
    servidor.close();
    return;
  }

  const desde = Math.max(0, args.desde);
  const hasta = Math.min(duracion, args.hasta ?? duracion);
  const cuadros = Math.round((hasta - desde) * fps);
  const salida = args.salida
    ? path.resolve(RAIZ, args.salida)
    : path.join(RAIZ, 'salida', `${guion.id}.mp4`);

  console.log(`\n${guion.titulo || guion.id}`);
  console.log(`  ${info.escenas.length} escenas | ${duracion.toFixed(1)}s | ${ancho}x${alto} @ ${fps}fps | ${cuadros} cuadros`);

  // 3) Render por tramos en paralelo.
  //
  // Capturar un cuadro es trabajo de CPU (rasterizar + comprimir a JPEG) y con
  // un solo proceso se desaprovechan los demas nucleos. Como __ir(t) no depende
  // del cuadro anterior, el video se puede partir en tramos contiguos que se
  // renderizan a la vez y se unen despues sin recodificar.
  const trabajadores = Math.max(1, Math.min(args.trabajadores || Math.max(1, os.cpus().length - 1), 8));
  const tmp = path.join(RAIZ, 'temporal', guion.id);
  fs.mkdirSync(tmp, { recursive: true });

  const porTramo = Math.ceil(cuadros / trabajadores);
  const tramos = [];
  for (let inicio = 0; inicio < cuadros; inicio += porTramo) {
    tramos.push({ desde: inicio, cantidad: Math.min(porTramo, cuadros - inicio) });
  }

  console.log(`  ${tramos.length} tramo(s) en paralelo sobre ${os.cpus().length} nucleos`);

  const hechos = new Array(tramos.length).fill(0);
  const inicioReloj = Date.now();
  let ultimoAviso = 0;

  function avisar() {
    const total = hechos.reduce((a, b) => a + b, 0);
    const ahora = Date.now();
    if (ahora - ultimoAviso < 2000 && total < cuadros) return;
    ultimoAviso = ahora;
    const seg = (ahora - inicioReloj) / 1000;
    const falta = total ? (seg / total) * (cuadros - total) : 0;
    const min = Math.floor(falta / 60);
    process.stdout.write(
      `\r  renderizando ${((total / cuadros) * 100).toFixed(0).padStart(3)}%  ` +
      `(faltan ~${min > 0 ? `${min} min` : `${Math.ceil(falta)} s`})      `
    );
  }

  async function renderizarTramo(tramo, indice) {
    const p = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.error('Error en la escena:', e.message));
    await p.goto(`http://127.0.0.1:${puerto}/`, { waitUntil: 'load' });
    await p.waitForFunction('window.__listo === true', null, { timeout: 30000 });
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate((k) => { document.getElementById('lienzo').style.transform = `scale(${k})`; }, args.escala);
    await p.evaluate((g) => window.__montar(g), guion);

    const destino = path.join(tmp, `tramo-${String(indice).padStart(2, '0')}.mp4`);
    const ff = spawn(ffmpegBin(), [
      '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
      '-c:v', 'libx264', '-preset', args.preset, '-crf', String(args.crf),
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(fps * 2), destino,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    let log = '';
    ff.stderr.on('data', (d) => { log += d.toString(); if (log.length > 20000) log = log.slice(-10000); });
    ff.stdin.on('error', () => { /* se reporta al cerrar */ });
    const termino = once(ff, 'close');

    for (let i = 0; i < tramo.cantidad; i++) {
      const t = desde + (tramo.desde + i) / fps;
      await p.evaluate((tt) => window.__ir(tt), t);
      const buf = await p.screenshot({ type: 'jpeg', quality: args.calidadCuadro });
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
      hechos[indice] = i + 1;
      if (i % 15 === 0) avisar();
    }
    ff.stdin.end();
    await p.close();

    const [codigo] = await termino;
    if (codigo !== 0) throw new Error(`ffmpeg del tramo ${indice} fallo (${codigo}):\n${log.slice(-1500)}`);
    return destino;
  }

  const partes = await Promise.all(tramos.map((tr, i) => renderizarTramo(tr, i)));
  avisar();
  process.stdout.write('\n');

  // Unir los tramos sin recodificar y pegarle el audio.
  let video = partes[0];
  if (partes.length > 1) {
    const lista = path.join(tmp, 'tramos.txt');
    fs.writeFileSync(lista, partes.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    video = path.join(tmp, 'video.mp4');
    execFileSync(ffmpegBin(), ['-y', '-v', 'error', '-f', 'concat', '-safe', '0',
      '-i', lista, '-c', 'copy', video]);
  }

  execFileSync(ffmpegBin(), [
    '-y', '-v', 'error', '-i', video,
    ...(audioWav ? ['-i', audioWav, '-map', '0:v', '-map', '1:a'] : []),
    '-c:v', 'copy',
    ...(audioWav ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest'] : []),
    '-movflags', '+faststart', salida,
  ]);

  for (const p of partes) fs.rmSync(p, { force: true });
  fs.rmSync(path.join(tmp, 'video.mp4'), { force: true });
  fs.rmSync(path.join(tmp, 'tramos.txt'), { force: true });

  // 4) Miniatura tomada de la portada, donde el titulo ya esta completo.
  if (!args.sinMiniatura) {
    const escenaIntro = info.escenas.find((e) => e.tipo === 'intro') || info.escenas[0];
    const tMini = escenaIntro.inicio + Math.min(escenaIntro.dur - 0.2, 2.6);
    const rutaMini = path.join(RAIZ, 'salida', `${guion.id}-miniatura.jpg`);
    await pagina.setViewportSize({ width: 1280, height: 720 });
    await pagina.evaluate(() => { document.getElementById('lienzo').style.transform = 'scale(0.6666667)'; });
    await pagina.evaluate((t) => window.__ir(t), tMini);
    await pagina.screenshot({ path: rutaMini, type: 'jpeg', quality: 92 });
    console.log(`  miniatura: ${path.relative(RAIZ, rutaMini)}`);
  }

  await navegador.close();
  servidor.close();

  const mb = (fs.statSync(salida).size / 1e6).toFixed(1);
  const seg = (Date.now() - inicioReloj) / 1000;
  const reloj = seg > 90 ? `${Math.floor(seg / 60)} min ${Math.round(seg % 60)} s` : `${seg.toFixed(0)} s`;
  console.log(`\nListo: ${path.relative(RAIZ, salida)}  (${mb} MB, ${duracion.toFixed(1)}s de video, render en ${reloj})`);
}

main().catch((e) => {
  console.error('\n' + (e.stack || e.message));
  process.exit(1);
});
