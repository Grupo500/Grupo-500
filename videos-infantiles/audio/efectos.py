#!/usr/bin/env python3
"""
Efectos de sonido sintetizados y mezclados sobre la banda sonora.

Los tiempos no se calculan aqui: los reporta el motor de animacion, que es el
que sabe en que segundo exacto aparece cada objeto. Asi el "pop" cae justo con
el rebote de la manzana y no un cuadro despues.

Se invoca desde render.mjs con el archivo de eventos que produce el motor:

    python3 audio/efectos.py --guion guiones/101-colores-compilado.json \
                             --eventos temporal/101-colores-compilado/eventos.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from comun import RAIZ, SR, cargar_guion, leer_audio
from musica import escribir_wav

# Volumen de cada tipo de efecto. Bajos a proposito: acompanan, no tapan la voz.
NIVELES = {
    'pop': 0.30, 'ding': 0.26, 'ding-alto': 0.20, 'chime': 0.30,
    'fanfare': 0.34, 'sparkle': 0.18, 'aparece': 0.28,
}


def _dec(n: int, tau: float, ataque: float = 0.002) -> np.ndarray:
    """Envolvente percusiva: ataque muy corto y caida exponencial."""
    t = np.arange(n) / SR
    env = np.exp(-t / tau)
    na = max(1, int(ataque * SR))
    if na < n:
        env[:na] *= np.linspace(0.0, 1.0, na)
    return env


def _campana(freq: float, dur: float, tau: float = 0.45) -> np.ndarray:
    """Campana / glockenspiel: parciales inarmonicos, brillante y limpia."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    onda = np.zeros(n)
    for mult, peso, decae in ((1.0, 1.0, 1.0), (2.76, 0.42, 0.7), (5.40, 0.18, 0.45)):
        onda += peso * np.sin(2 * np.pi * freq * mult * t) * np.exp(-t / (tau * decae))
    return onda * _dec(n, tau * 1.2)


def _pop(freq_ini: float = 520.0, freq_fin: float = 980.0, dur: float = 0.11) -> np.ndarray:
    """Burbuja: la frecuencia sube rapido, como algo que brota."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    barrido = freq_ini + (freq_fin - freq_ini) * (t / dur) ** 0.6
    fase = 2 * np.pi * np.cumsum(barrido) / SR
    return (np.sin(fase) + 0.25 * np.sin(2 * fase)) * _dec(n, 0.035, 0.001)


def _arpegio(frecs: list[float], paso: float, dur_nota: float, tau: float = 0.35) -> np.ndarray:
    total = int((paso * (len(frecs) - 1) + dur_nota + 0.1) * SR)
    salida = np.zeros(total)
    for i, f in enumerate(frecs):
        nota = _campana(f, dur_nota, tau)
        ini = int(i * paso * SR)
        salida[ini:ini + len(nota)] += nota
    return salida


def _brillo(semilla: int = 3) -> np.ndarray:
    """Chispas: campanitas agudas dispersas."""
    rng = np.random.default_rng(semilla)
    total = int(0.6 * SR)
    salida = np.zeros(total)
    for _ in range(6):
        f = float(rng.uniform(1800, 3600))
        nota = _campana(f, 0.28, 0.12)
        ini = int(rng.uniform(0, 0.3) * SR)
        salida[ini:ini + len(nota)] += nota * 0.5
    return salida


def _fanfarria() -> np.ndarray:
    """Cierre alegre de cuatro notas: Do - Mi - Sol - Do agudo."""
    return _arpegio([523.25, 659.25, 783.99, 1046.50], 0.13, 0.55, 0.4)


def biblioteca() -> dict[str, np.ndarray]:
    """Cada efecto se sintetiza una vez y se reutiliza en todo el video."""
    efectos = {
        'pop': _pop(),
        'ding': _campana(1174.66, 0.7, 0.42),          # Re6
        'ding-alto': _campana(1567.98, 0.6, 0.34),     # Sol6, para el ingles
        'chime': _arpegio([783.99, 987.77, 1174.66], 0.09, 0.6, 0.4),
        'fanfare': _fanfarria(),
        'sparkle': _brillo(),
        'aparece': _pop(300.0, 720.0, 0.18),
    }
    for nombre, onda in efectos.items():
        pico = float(np.max(np.abs(onda))) or 1.0
        efectos[nombre] = onda / pico * NIVELES.get(nombre, 0.25)
    return efectos


def mezclar(guion_id: str, eventos: list[dict]) -> dict:
    carpeta = RAIZ / 'temporal' / guion_id
    ruta_audio = carpeta / 'audio.wav'
    if not ruta_audio.exists():
        raise SystemExit(f'Falta {ruta_audio}. Corre primero audio/preparar.py')

    base = leer_audio(ruta_audio)
    efectos = biblioteca()

    pista = np.zeros(len(base))
    usados: dict[str, int] = {}
    for ev in eventos:
        onda = efectos.get(ev['tipo'])
        if onda is None:
            continue
        i = int(float(ev['t']) * SR)
        if i < 0 or i >= len(pista):
            continue
        fin = min(len(pista), i + len(onda))
        pista[i:fin] += onda[:fin - i]
        usados[ev['tipo']] = usados.get(ev['tipo'], 0) + 1

    # Los efectos se suman sin pisar la mezcla: si el pico se pasa, se baja todo
    # en bloque para no alterar el balance entre voz, musica y efectos.
    mezcla = base + pista
    pico = float(np.max(np.abs(mezcla)))
    if pico > 0.97:
        mezcla = mezcla / pico * 0.97

    escribir_wav(ruta_audio, mezcla)
    return usados


def main() -> None:
    ap = argparse.ArgumentParser(description='Mezcla efectos de sonido en la banda sonora')
    ap.add_argument('--guion', required=True)
    ap.add_argument('--eventos', required=True)
    a = ap.parse_args()

    guion = cargar_guion(a.guion)
    eventos = json.loads(Path(a.eventos).read_text(encoding='utf-8'))
    usados = mezclar(guion['id'], eventos)
    detalle = ', '.join(f'{k}×{v}' for k, v in sorted(usados.items()))
    print(f'  efectos mezclados: {sum(usados.values())} ({detalle})')


if __name__ == '__main__':
    main()
