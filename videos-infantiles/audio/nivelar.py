#!/usr/bin/env python3
"""
Ajusta el volumen de la banda sonora al estandar de YouTube.

YouTube normaliza a -14 LUFS, pero solo hacia abajo: si un video llega mas bajo,
lo deja tal cual y suena mas flojo que el resto del canal (medido en este
proyecto: -22 LUFS sin normalizar, 8 dB por debajo). Por eso se nivela aca.

Se usa loudnorm en dos pasadas, que es bastante mas preciso que una sola: la
primera mide el material y la segunda aplica la correccion exacta. Con
linear=true la ganancia es uniforme, asi que no se comprime la dinamica entre
la voz, la musica y los efectos.

    python3 audio/nivelar.py --guion guiones/001-los-colores.json
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

from comun import RAIZ, SR, cargar_guion, ffmpeg_bin

OBJETIVO_LUFS = -14.0
PICO_MAXIMO = -1.0   # dBTP, margen para que el AAC no sature al codificar
RANGO = 11.0


def medir(ruta: Path) -> dict:
    """Primera pasada: loudnorm reporta las medidas en JSON por stderr."""
    salida = subprocess.run(
        [ffmpeg_bin(), "-hide_banner", "-i", str(ruta),
         "-af", f"loudnorm=I={OBJETIVO_LUFS}:TP={PICO_MAXIMO}:LRA={RANGO}:print_format=json",
         "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    bloques = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", salida, re.S)
    if not bloques:
        raise RuntimeError("loudnorm no devolvio medidas. Salida:\n" + salida[-800:])
    return json.loads(bloques[-1])


def nivelar(ruta: Path) -> dict:
    m = medir(ruta)
    filtro = (
        f"loudnorm=I={OBJETIVO_LUFS}:TP={PICO_MAXIMO}:LRA={RANGO}"
        f":measured_I={m['input_i']}:measured_TP={m['input_tp']}"
        f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
        f":offset={m['target_offset']}:linear=true:print_format=summary"
    )
    temporal = ruta.with_suffix(".nivelado.wav")
    subprocess.run(
        [ffmpeg_bin(), "-y", "-v", "error", "-i", str(ruta),
         "-af", filtro, "-ar", str(SR), "-c:a", "pcm_s16le", str(temporal)],
        check=True, capture_output=True,
    )
    temporal.replace(ruta)
    return m


def main() -> None:
    ap = argparse.ArgumentParser(description="Nivela el audio a -14 LUFS")
    ap.add_argument("--guion", required=True)
    a = ap.parse_args()

    guion = cargar_guion(a.guion)
    ruta = RAIZ / "temporal" / guion["id"] / "audio.wav"
    if not ruta.exists():
        raise SystemExit(f"Falta {ruta}. Corre primero audio/preparar.py")

    m = nivelar(ruta)
    print(f"  nivelado: {float(m['input_i']):.1f} -> {OBJETIVO_LUFS:.0f} LUFS "
          f"(pico {float(m['input_tp']):.1f} dBTP, rango {float(m['input_lra']):.1f} LU)")


if __name__ == "__main__":
    main()
