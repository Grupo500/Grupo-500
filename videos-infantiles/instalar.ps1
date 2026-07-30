# Instalador para Windows (PowerShell).
# Deja el equipo listo para producir los videos con voz Kokoro, local y gratis.
#
#   powershell -ExecutionPolicy Bypass -File instalar.ps1
#   node producir.mjs --motor kokoro
#
# Requisitos previos:
#   Node 18+       nodejs.org
#   Python 3.10-3.13  python.org, marcando "Add Python to PATH" al instalar
#                     (kokoro-onnx todavia no soporta Python 3.14)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Resolver-Python {
    foreach ($c in @('python', 'py', 'python3')) {
        try {
            & $c -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info < (3,14) else 1)' 2>$null
            if ($LASTEXITCODE -eq 0) { return $c }
        } catch { }
    }
    throw "No se encontro Python 3.10-3.13. Instalalo desde python.org marcando 'Add Python to PATH'."
}

Write-Host "==> Node y Python" -ForegroundColor Cyan
node --version
$py = Resolver-Python
& $py --version
Write-Host "    (usando '$py')"

Write-Host "`n==> Dependencias de Node (Playwright y la tipografia)" -ForegroundColor Cyan
npm install
try {
    npx playwright install chromium
} catch {
    Write-Host "    Playwright no pudo bajar Chromium; render.mjs buscara Chrome o Edge del sistema." -ForegroundColor Yellow
}

Write-Host "`n==> Dependencias de Python (audio y ffmpeg)" -ForegroundColor Cyan
# Actualizar pip no es necesario y puede fallar segun como este instalado Python.
try { & $py -m pip install --upgrade pip } catch { Write-Host "    (no se pudo actualizar pip, se continua)" -ForegroundColor Yellow }
& $py -m pip install numpy imageio-ffmpeg

Write-Host "`n==> Motor de voz Kokoro-82M" -ForegroundColor Cyan
# kokoro-onnx (no "kokoro"): publica los pesos en releases de GitHub y trae
# espeak-ng empaquetado en espeakng-loader, asi que en Windows no hay que
# instalar espeak-ng aparte ni configurar ninguna variable de entorno.
& $py -m pip install kokoro-onnx soundfile

Write-Host "`n==> Comprobando que el motor de voz carga" -ForegroundColor Cyan
& $py -c "import espeakng_loader, onnxruntime, soundfile; from kokoro_onnx import Kokoro; print('    kokoro-onnx OK, espeak-ng incluido')"

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "Listo. Para producir los cuatro compilados (voz + video):"
Write-Host ""
Write-Host "    node producir.mjs --motor kokoro" -ForegroundColor White
Write-Host ""
Write-Host "La primera vez baja los pesos del modelo (~338 MB) desde releases de"
Write-Host "GitHub; despues trabaja sin internet. Cada compilado de 49 minutos"
Write-Host "tarda una hora y media larga, segun los nucleos del equipo."
Write-Host ""
Write-Host "Para probar rapido antes de comprometer ese tiempo:"
Write-Host ""
Write-Host "    node producir.mjs --motor kokoro --guion guiones/001-los-colores.json" -ForegroundColor White
Write-Host ""
Write-Host "Los MP4 y las miniaturas quedan en:  videos-infantiles\salida\" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
