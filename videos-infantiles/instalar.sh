#!/usr/bin/env bash
# Instala todo lo necesario para producir los videos en un equipo propio,
# con voz Kokoro (local, gratis y sin cuenta).
#
#   bash instalar.sh
#   node producir.mjs --motor kokoro
#
# Requisitos previos: Node 18+, Python 3.10 a 3.13 y git.

set -euo pipefail
cd "$(dirname "$0")"

echo "==> Node y Python"
node --version || { echo "Falta Node 18+. Instalalo desde nodejs.org"; exit 1; }

PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info < (3,14) else 1)' 2>/dev/null; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  echo "Falta Python 3.10-3.13 (kokoro-onnx todavia no soporta 3.14). Instalalo desde python.org"
  exit 1
fi
"$PY" --version
echo "    (usando '$PY')"

echo
echo "==> Dependencias de Node (Playwright y la tipografia)"
npm install
# Chromium: si el sistema ya trae uno, render.mjs lo reutiliza solo.
npx playwright install chromium || echo "  (si falla, render.mjs busca un Chromium del sistema)"

echo
echo "==> Dependencias de Python (audio y ffmpeg)"
# Actualizar pip falla en los Python que gestiona el sistema (Debian, Ubuntu):
# no es necesario, asi que si falla se sigue igual.
"$PY" -m pip install --upgrade pip 2>/dev/null || echo "  (no se pudo actualizar pip, se continua)"
"$PY" -m pip install numpy imageio-ffmpeg

echo
echo "==> Motor de voz Kokoro-82M"
# kokoro-onnx (no "kokoro"): publica los pesos en releases de GitHub y trae
# espeak-ng empaquetado en espeakng-loader, asi que no hay que instalarlo aparte.
"$PY" -m pip install kokoro-onnx soundfile

echo
echo "==> Comprobando que el motor de voz carga"
"$PY" - <<'PY'
import espeakng_loader, onnxruntime, soundfile  # noqa: F401
from kokoro_onnx import Kokoro  # noqa: F401
print("    kokoro-onnx OK, espeak-ng incluido")
PY

echo
echo "======================================================================"
echo "Listo. Para producir los cuatro compilados (voz + video):"
echo
echo "    node producir.mjs --motor kokoro"
echo
echo "La primera vez baja los pesos del modelo (~338 MB) desde releases de"
echo "GitHub; despues trabaja sin internet. Cada compilado de 49 minutos tarda"
echo "una hora y media larga en render, segun los nucleos que tenga el equipo."
echo
echo "Para probar rapido antes de comprometer ese tiempo:"
echo
echo "    node producir.mjs --motor kokoro --guion guiones/001-los-colores.json"
echo "======================================================================"
