#!/usr/bin/env bash
# Instala todo lo necesario para producir los videos en un equipo propio,
# con voz Kokoro (local, gratis y sin cuenta).
#
#   bash instalar.sh
#   node producir.mjs --motor kokoro
#
# Requisitos previos: Node 18+, Python 3.10+ y git.

set -euo pipefail
cd "$(dirname "$0")"

echo "==> Node y Python"
node --version || { echo "Falta Node 18+. Instalalo desde nodejs.org"; exit 1; }
python3 --version || { echo "Falta Python 3.10+"; exit 1; }

echo
echo "==> Dependencias de Node (Playwright y la tipografia)"
npm install
# Chromium: si el sistema ya trae uno, render.mjs lo reutiliza solo.
npx playwright install chromium || echo "  (si falla, render.mjs busca un Chromium del sistema)"

echo
echo "==> Dependencias de Python (audio y ffmpeg)"
python3 -m pip install --upgrade pip
python3 -m pip install numpy imageio-ffmpeg

echo
echo "==> Motor de voz Kokoro-82M"
python3 -m pip install kokoro soundfile "misaki[es]"

echo
echo "==> espeak-ng (necesario para el espanol)"
if command -v espeak-ng >/dev/null 2>&1; then
  echo "  ya esta instalado"
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y espeak-ng
elif command -v brew >/dev/null 2>&1; then
  brew install espeak-ng
elif command -v choco >/dev/null 2>&1; then
  choco install espeak-ng
else
  echo "  ATENCION: instalalo a mano. Sin espeak-ng, Kokoro no puede leer espanol."
  echo "    Linux:   sudo apt install espeak-ng"
  echo "    macOS:   brew install espeak-ng"
  echo "    Windows: choco install espeak-ng"
fi

echo
echo "======================================================================"
echo "Listo. Para producir los cuatro compilados (voz + video):"
echo
echo "    node producir.mjs --motor kokoro"
echo
echo "La primera vez Kokoro baja sus pesos (~330 MB); despues trabaja sin"
echo "internet. Cada compilado de 20 min tarda cerca de una hora en render."
echo
echo "Para probar rapido antes de comprometer ese tiempo:"
echo
echo "    node producir.mjs --motor kokoro --guion guiones/001-los-colores.json"
echo "======================================================================"
