#!/usr/bin/env python3
"""
Generador de musica instrumental para los videos.

La musica se sintetiza aqui mismo con numpy, asi que es 100% original: no hay
reclamos de Content ID ni licencias que renovar. El estilo es de caja musical /
marimba sobre escala pentatonica, que nunca produce disonancias y es el sonido
tipico del contenido para 2-4 anos.

Uso:
    python3 audio/musica.py --segundos 90 --estilo alegre --salida temporal/musica.wav
"""

from __future__ import annotations

import argparse
import math
import wave
from pathlib import Path

import numpy as np

SR = 44100

# Escala pentatonica de Do mayor: suena bien en cualquier combinacion.
PENTATONICA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]

# Progresion I - V - vi - IV (Do - Sol - La menor - Fa).
PROGRESION = [
    (130.81, [261.63, 329.63, 392.00]),   # Do
    (196.00, [392.00, 493.88, 587.33]),   # Sol
    (220.00, [440.00, 523.25, 659.25]),   # La menor
    (174.61, [349.23, 440.00, 523.25]),   # Fa
]

ESTILOS = {
    "alegre":    {"tempo": 104, "shaker": True,  "melodia": 1.0, "arpegio": 0.8, "bajo": 0.9},
    "juguetona": {"tempo": 116, "shaker": True,  "melodia": 1.0, "arpegio": 0.6, "bajo": 1.0},
    "suave":     {"tempo": 76,  "shaker": False, "melodia": 0.8, "arpegio": 1.0, "bajo": 0.6},
    "arrullo":   {"tempo": 64,  "shaker": False, "melodia": 0.7, "arpegio": 1.0, "bajo": 0.4},
}


def _envolvente(n: int, ataque: float, decaimiento: float) -> np.ndarray:
    """Ataque lineal corto + caida exponencial (percusion tonal)."""
    t = np.arange(n) / SR
    env = np.exp(-t / max(decaimiento, 1e-3))
    na = max(1, int(ataque * SR))
    if na < n:
        env[:na] *= np.linspace(0.0, 1.0, na)
    return env


def _nota(freq: float, dur: float, tipo: str = "marimba", vel: float = 1.0) -> np.ndarray:
    n = max(1, int(dur * SR))
    t = np.arange(n) / SR

    if tipo == "marimba":
        onda = (np.sin(2 * np.pi * freq * t)
                + 0.42 * np.sin(2 * np.pi * freq * 2 * t)
                + 0.16 * np.sin(2 * np.pi * freq * 4 * t))
        env = _envolvente(n, 0.004, 0.34)
    elif tipo == "caja":  # caja musical / glockenspiel
        vib = 1 + 0.0035 * np.sin(2 * np.pi * 5.2 * t)
        onda = (np.sin(2 * np.pi * freq * t * vib)
                + 0.30 * np.sin(2 * np.pi * freq * 3 * t)
                + 0.10 * np.sin(2 * np.pi * freq * 5 * t))
        env = _envolvente(n, 0.002, 0.85)
    elif tipo == "bajo":
        onda = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2 * t)
        onda = np.tanh(onda * 1.3)
        env = _envolvente(n, 0.010, 0.42)
    else:
        raise ValueError(f"tipo de nota desconocido: {tipo}")

    return onda * env * vel


def _shaker(dur: float, rng: np.random.Generator, vel: float = 1.0) -> np.ndarray:
    n = max(1, int(dur * SR))
    ruido = rng.standard_normal(n)
    # Diferenciar realza los agudos: suena a maraca en vez de a golpe sordo.
    ruido = np.diff(ruido, prepend=0.0)
    return ruido * _envolvente(n, 0.001, 0.045) * vel


def _mezclar_en(pista: np.ndarray, muestra: np.ndarray, inicio_s: float) -> None:
    i = int(inicio_s * SR)
    if i >= len(pista):
        return
    fin = min(len(pista), i + len(muestra))
    pista[i:fin] += muestra[: fin - i]


def _reverberacion(x: np.ndarray) -> np.ndarray:
    """Reverb barata de dos retardos con filtrado suave: da aire sin ensuciar."""
    salida = x.copy()
    for retardo_ms, ganancia in ((87, 0.24), (149, 0.15), (211, 0.09)):
        d = int(SR * retardo_ms / 1000)
        eco = np.zeros_like(x)
        eco[d:] = x[:-d]
        # Promedio movil corto = filtro pasabajos, para que el eco no suene metalico.
        k = 24
        eco = np.convolve(eco, np.ones(k) / k, mode="same")
        salida += eco * ganancia
    return salida


def generar(segundos: float, estilo: str = "alegre", semilla: int = 7) -> np.ndarray:
    """Devuelve una pista mono normalizada de la duracion pedida."""
    cfg = ESTILOS.get(estilo, ESTILOS["alegre"])
    rng = np.random.default_rng(semilla)
    tempo = cfg["tempo"]
    negra = 60.0 / tempo
    compas = negra * 4
    total = float(segundos) + 2.0  # cola para que la reverb no se corte
    pista = np.zeros(int(total * SR))

    n_compases = int(math.ceil(total / compas))
    idx_melodia = 4  # posicion inicial en la escala

    for c in range(n_compases):
        t0 = c * compas
        raiz, acorde = PROGRESION[c % len(PROGRESION)]

        # Bajo: fundamental en el 1 y en el 3.
        if cfg["bajo"]:
            _mezclar_en(pista, _nota(raiz, negra * 1.6, "bajo", 0.55 * cfg["bajo"]), t0)
            _mezclar_en(pista, _nota(raiz, negra * 1.4, "bajo", 0.40 * cfg["bajo"]), t0 + negra * 2)

        # Arpegio de caja musical en corcheas.
        if cfg["arpegio"]:
            for i in range(8):
                if i % 2 == 1 and rng.random() < 0.35:
                    continue
                f = acorde[i % len(acorde)] * (2.0 if i >= 4 else 1.0)
                _mezclar_en(pista, _nota(f, negra * 1.2, "caja", 0.20 * cfg["arpegio"]), t0 + i * negra / 2)

        # Melodia de marimba: caminata aleatoria sobre la pentatonica.
        if cfg["melodia"]:
            pos = 0.0
            while pos < compas - 1e-6:
                if rng.random() < 0.16:  # silencio: deja respirar la frase
                    pos += negra / 2
                    continue
                dur = negra * rng.choice([0.5, 0.5, 1.0, 1.0, 1.5])
                idx_melodia = int(np.clip(idx_melodia + rng.integers(-2, 3), 0, len(PENTATONICA) - 1))
                f = PENTATONICA[idx_melodia]
                _mezclar_en(pista, _nota(f, min(dur * 1.6, 0.9), "marimba", 0.30 * cfg["melodia"]), t0 + pos)
                pos += dur

        # Shaker en contratiempo.
        if cfg["shaker"]:
            for i in range(8):
                vel = 0.16 if i % 2 == 0 else 0.09
                _mezclar_en(pista, _shaker(0.09, rng, vel), t0 + i * negra / 2)

    pista = _reverberacion(pista)[: int(segundos * SR)]

    # Entrada y salida suaves.
    fade = int(0.8 * SR)
    if len(pista) > fade * 2:
        pista[:fade] *= np.linspace(0, 1, fade)
        pista[-fade:] *= np.linspace(1, 0, fade)

    pico = float(np.max(np.abs(pista))) or 1.0
    return pista / pico * 0.72


def escribir_wav(ruta: str | Path, mono: np.ndarray, estereo: bool = True) -> Path:
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    datos = np.stack([mono, mono], axis=1) if estereo else mono.reshape(-1, 1)
    pcm = np.clip(datos, -1.0, 1.0)
    pcm = (pcm * 32767).astype("<i2")
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return ruta


def main() -> None:
    ap = argparse.ArgumentParser(description="Genera musica instrumental original")
    ap.add_argument("--segundos", type=float, required=True)
    ap.add_argument("--estilo", default="alegre", choices=sorted(ESTILOS))
    ap.add_argument("--semilla", type=int, default=7)
    ap.add_argument("--salida", default="temporal/musica.wav")
    a = ap.parse_args()
    ruta = escribir_wav(a.salida, generar(a.segundos, a.estilo, a.semilla))
    print(f"musica: {ruta} ({a.segundos:.1f}s, estilo {a.estilo})")


if __name__ == "__main__":
    main()
