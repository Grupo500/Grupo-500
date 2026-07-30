# Instalador para Windows (PowerShell).
# Deja el equipo listo para producir los videos con voz Kokoro, local y gratis.
#
#   powershell -ExecutionPolicy Bypass -File instalar.ps1
#   node producir.mjs --motor kokoro
#
# Requisitos previos: Node 18+ (nodejs.org) y Python 3.10+ (python.org,
# marcando "Add Python to PATH" durante la instalacion).

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Resolver-Python {
    foreach ($c in @('python', 'py', 'python3')) {
        try {
            $v = & $c --version 2>&1
            if ($LASTEXITCODE -eq 0) { return $c }
        } catch { }
    }
    throw "No se encontro Python. Instalalo desde python.org marcando 'Add Python to PATH'."
}

Write-Host "==> Node y Python" -ForegroundColor Cyan
node --version
$py = Resolver-Python
& $py --version
Write-Host "    (usando '$py' como comando de Python)"

Write-Host "`n==> Dependencias de Node (Playwright y la tipografia)" -ForegroundColor Cyan
npm install
try {
    npx playwright install chromium
} catch {
    Write-Host "    Playwright no pudo bajar Chromium; render.mjs buscara Chrome o Edge del sistema." -ForegroundColor Yellow
}

Write-Host "`n==> Dependencias de Python (audio y ffmpeg)" -ForegroundColor Cyan
& $py -m pip install --upgrade pip
& $py -m pip install numpy imageio-ffmpeg

Write-Host "`n==> Motor de voz Kokoro-82M" -ForegroundColor Cyan
& $py -m pip install kokoro soundfile "misaki[es]"

Write-Host "`n==> espeak-ng (necesario para el espanol)" -ForegroundColor Cyan
if (Get-Command espeak-ng -ErrorAction SilentlyContinue) {
    Write-Host "    ya esta instalado"
} elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install espeak-ng -y
} elseif (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id eSpeak-NG.eSpeak-NG --accept-source-agreements --accept-package-agreements
} else {
    Write-Host "    ATENCION: instalalo a mano, sin esto Kokoro no puede leer espanol." -ForegroundColor Yellow
    Write-Host "    Descarga el instalador .msi de: github.com/espeak-ng/espeak-ng/releases"
}

# Kokoro busca la libreria de espeak por variable de entorno en Windows.
$dll = "$env:ProgramFiles\eSpeak NG\libespeak-ng.dll"
if (Test-Path $dll) {
    Write-Host "`n==> Configurando PHONEMIZER_ESPEAK_LIBRARY" -ForegroundColor Cyan
    [Environment]::SetEnvironmentVariable('PHONEMIZER_ESPEAK_LIBRARY', $dll, 'User')
    $env:PHONEMIZER_ESPEAK_LIBRARY = $dll
    Write-Host "    $dll"
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "Listo. Para producir los cuatro compilados (voz + video):"
Write-Host ""
Write-Host "    node producir.mjs --motor kokoro" -ForegroundColor White
Write-Host ""
Write-Host "La primera vez Kokoro baja sus pesos (~330 MB); despues trabaja sin"
Write-Host "internet. Cada compilado de 20 min tarda cerca de una hora en render."
Write-Host ""
Write-Host "Para probar rapido antes de comprometer ese tiempo:"
Write-Host ""
Write-Host "    node producir.mjs --motor kokoro --guion guiones/001-los-colores.json" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
