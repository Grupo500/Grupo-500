"""Utilidades compartidas por los scripts de audio."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
RAIZ = Path(__file__).resolve().parent.parent


def ffmpeg_bin() -> str:
    """Ubica un ffmpeg completo (con H.264 y AAC)."""
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    encontrado = shutil.which("ffmpeg")
    if encontrado:
        return encontrado
    raise RuntimeError(
        "No se encontro ffmpeg. Instalalo con: pip install imageio-ffmpeg  (o apt install ffmpeg)"
    )


def leer_audio(ruta: Path) -> np.ndarray:
    """Decodifica cualquier formato a mono float32 a 44.1 kHz usando ffmpeg."""
    salida = subprocess.run(
        [ffmpeg_bin(), "-v", "error", "-i", str(ruta),
         "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    ).stdout
    return np.frombuffer(salida, dtype="<f4").astype(np.float64)


def cargar_guion(ruta: str | Path) -> dict:
    with open(ruta, encoding="utf-8") as f:
        guion = json.load(f)
    guion.setdefault("id", Path(ruta).stem)
    return guion


def clips_de_voz(guion_id: str, n_escenas: int) -> list[Path | None]:
    """
    Busca la narracion de cada escena en voz/<id>/.
    Acepta 01.wav, 01.mp3, 01.m4a... (numeracion desde 1).
    Los .wav grabados por una persona tienen prioridad sobre los generados.
    """
    carpeta = RAIZ / "voz" / guion_id
    resultado: list[Path | None] = []
    for i in range(1, n_escenas + 1):
        hallado = None
        for ext in (".wav", ".flac", ".m4a", ".mp3", ".ogg"):
            p = carpeta / f"{i:02d}{ext}"
            if p.exists():
                hallado = p
                break
        resultado.append(hallado)
    return resultado
