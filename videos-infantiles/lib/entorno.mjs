/**
 * Localiza las herramientas externas que necesita el render, de forma que
 * funcione igual en Linux, macOS y Windows.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Intenta ejecutar cada candidato y devuelve el primero que responde. */
function primeroQueFunciona(candidatos, argumentos) {
  for (const cmd of candidatos) {
    if (!cmd) continue;
    try {
      execFileSync(cmd, argumentos, { stdio: 'ignore', timeout: 20000 });
      return cmd;
    } catch { /* siguiente candidato */ }
  }
  return null;
}

let _python = null;

/**
 * Comando de Python disponible. En Windows suele ser "python" o "py", no
 * "python3", asi que hay que probar varios en vez de asumir uno.
 */
export function comandoPython() {
  if (_python) return _python;
  _python = primeroQueFunciona(
    [process.env.PYTHON, 'python3', 'python', 'py'],
    ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)']
  );
  if (!_python) {
    throw new Error(
      'No se encontro Python 3.9+. Instalalo desde python.org y volve a intentar.\n' +
      'Si esta instalado con otro nombre, indicalo con la variable PYTHON.'
    );
  }
  return _python;
}

/** ffmpeg completo (con H.264 y AAC). */
export function ffmpegBin() {
  if (process.env.FFMPEG) return process.env.FFMPEG;

  const delSistema = primeroQueFunciona(['ffmpeg'], ['-version']);
  if (delSistema) return delSistema;

  // imageio-ffmpeg trae una compilacion estatica completa; es la via mas simple
  // en Windows, donde no suele haber ffmpeg en el PATH.
  try {
    return execFileSync(
      comandoPython(),
      ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],
      { encoding: 'utf8' }
    ).trim();
  } catch { /* no esta instalado */ }

  throw new Error('No se encontro ffmpeg. Instalalo con: pip install imageio-ffmpeg');
}

/**
 * Chromium para el render. Si Playwright no bajo su navegador, reutiliza uno
 * del sistema en vez de exigir "npx playwright install".
 */
export function candidatosChromium() {
  const lista = [process.env.CHROMIUM];

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      if (!dir.startsWith('chromium-')) continue;
      lista.push(
        path.join(base, dir, 'chrome-linux/chrome'),
        path.join(base, dir, 'chrome-win/chrome.exe'),
        path.join(base, dir, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
      );
    }
  }

  if (process.platform === 'win32') {
    for (const raiz of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]) {
      if (!raiz) continue;
      lista.push(
        path.join(raiz, 'Google/Chrome/Application/chrome.exe'),
        path.join(raiz, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(raiz, 'Chromium/Application/chrome.exe'),
      );
    }
  } else {
    for (const nombre of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
      try {
        lista.push(execFileSync('bash', ['-lc', `command -v ${nombre}`], { encoding: 'utf8' }).trim());
      } catch { /* no esta */ }
    }
    lista.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  }

  return lista.filter(Boolean);
}
