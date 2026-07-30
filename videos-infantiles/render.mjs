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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ANCHO_BASE = 1920;
const ALTO_BASE = 1080;

/* ---------------- argumentos ---------------- */

function leerArgs(argv) {
  const a = {
    guion: null, escala: 1, fps: null, crf: 20, preset: 'medium',
    salida: null, sinAudio: false, sinVoz: false,
    desde: 0, hasta: null, foto: null, fotos: null, calidadCuadro: 96, sinMiniatura: false,
  };
  const numeros = new Set(['escala', 'fps', 'crf', 'desde', 'hasta', 'foto', 'calidadCuadro']);
  const alias = { 'sin-audio': 'sinAudio', 'sin-voz': 'sinVoz', 'calidad-cuadro': 'calidadCuadro', 'sin-miniatura': 'sinMiniatura' };
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const bruto = argv[i].slice(2);
    const clave = alias[bruto] ?? bruto;
    if (clave === 'sinAudio' || clave === 'sinVoz' || clave === 'sinMiniatura') { a[clave] = true; continue; }
    const valor = argv[++i];
    a[clave] = numeros.has(clave) ? Number(valor) : valor;
  }
  if (!a.guion) {
    console.error('Falta --guion <ruta>. Ejemplo:\n  node render.mjs --guion guiones/001-los-colores.json');
    process.exit(1);
  }
  return a;
}

/* ---------------- herramientas externas ---------------- */

function ffmpegBin() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const intento of [
    () => execFileSync('bash', ['-lc', 'command -v ffmpeg'], { encoding: 'utf8' }).trim(),
    () => execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim(),
  ]) {
    try {
      const r = intento();
      if (r) return r;
    } catch { /* siguiente intento */ }
  }
  throw new Error('No se encontro ffmpeg. Instalalo con: pip install imageio-ffmpeg');
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

function candidatosChromium() {
  const lista = [process.env.CHROMIUM];
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      if (dir.startsWith('chromium-')) lista.push(path.join(base, dir, 'chrome-linux/chrome'));
    }
  }
  for (const nombre of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      lista.push(execFileSync('bash', ['-lc', `command -v ${nombre}`], { encoding: 'utf8' }).trim());
    } catch { /* no esta */ }
  }
  return lista.filter(Boolean);
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
    const salida = execFileSync('python3', args, { cwd: RAIZ, encoding: 'utf8' });
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

  // 3) ffmpeg recibe los cuadros por tuberia.
  const cmd = [
    '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
    ...(audioWav ? ['-i', audioWav, '-map', '0:v', '-map', '1:a'] : []),
    '-c:v', 'libx264', '-preset', args.preset, '-crf', String(args.crf),
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(fps * 2),
    ...(audioWav ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest'] : []),
    '-movflags', '+faststart', salida,
  ];
  const ff = spawn(ffmpegBin(), cmd, { stdio: ['pipe', 'ignore', 'pipe'] });
  let logFf = '';
  ff.stderr.on('data', (d) => { logFf += d.toString(); if (logFf.length > 40000) logFf = logFf.slice(-20000); });
  const terminoFf = once(ff, 'close');
  ff.stdin.on('error', () => { /* se reporta al cerrar */ });

  const inicio = Date.now();
  for (let i = 0; i < cuadros; i++) {
    const t = desde + i / fps;
    await pagina.evaluate((tt) => window.__ir(tt), t);
    const buf = await pagina.screenshot({ type: 'jpeg', quality: args.calidadCuadro });
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');

    if (i % Math.max(1, Math.floor(cuadros / 40)) === 0 || i === cuadros - 1) {
      const p = ((i + 1) / cuadros) * 100;
      const seg = (Date.now() - inicio) / 1000;
      const falta = seg / (i + 1) * (cuadros - i - 1);
      process.stdout.write(`\r  renderizando ${p.toFixed(0).padStart(3)}%  (faltan ~${Math.ceil(falta)}s)   `);
    }
  }
  ff.stdin.end();
  process.stdout.write('\n');

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

  const [codigo] = await terminoFf;
  if (codigo !== 0) {
    console.error(logFf.slice(-3000));
    throw new Error(`ffmpeg termino con codigo ${codigo}`);
  }

  const mb = (fs.statSync(salida).size / 1e6).toFixed(1);
  const seg = ((Date.now() - inicio) / 1000).toFixed(0);
  console.log(`\nListo: ${path.relative(RAIZ, salida)}  (${mb} MB, ${duracion.toFixed(1)}s de video, render en ${seg}s)`);
}

main().catch((e) => {
  console.error('\n' + (e.stack || e.message));
  process.exit(1);
});
