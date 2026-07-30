#!/usr/bin/env python3
"""
Arma la banda sonora final del video y calcula los tiempos definitivos.

Que hace:
  1. Busca la narracion de cada escena en voz/<id>/NN.(wav|mp3|...).
  2. Estira la duracion de cada escena para que quepa su narracion completa.
  3. Genera musica original del largo exacto que quedo el video.
  4. Baja el volumen de la musica cuando hay voz (ducking) y mezcla todo.
  5. Escribe temporal/<id>/audio.wav y temporal/<id>/tiempos.json

El renderizador lee tiempos.json para que la imagen quede sincronizada con la voz.

Uso:
    python3 audio/preparar.py --guion guiones/001-los-colores.json
"""

from __future__ import annotations

import argparse
import json
import zlib
from pathlib import Path

import numpy as np

from comun import RAIZ, SR, cargar_guion, clips_de_voz, leer_audio
from musica import escribir_wav, generar

# Espacio de silencio antes y despues de cada linea de narracion.
ANTES = 0.45
DESPUES = 0.75


def envolvente_voz(voz: np.ndarray, ventana: int = int(SR * 0.18)) -> np.ndarray:
    """Curva 0..1 que indica donde hay voz, para atenuar la musica ahi."""
    bloque = 512
    n_bloques = int(np.ceil(len(voz) / bloque))
    relleno = np.zeros(n_bloques * bloque)
    relleno[: len(voz)] = np.abs(voz)
    picos = relleno.reshape(n_bloques, bloque).max(axis=1)

    # Ensancha (para anticipar el ataque) y suaviza.
    radio = max(1, ventana // bloque)
    picos = np.array([picos[max(0, i - radio): i + radio + 1].max() for i in range(n_bloques)])
    k = max(3, radio * 2)
    picos = np.convolve(picos, np.ones(k) / k, mode="same")

    curva = np.repeat(picos, bloque)[: len(voz)]
    tope = float(curva.max()) or 1.0
    return np.clip(curva / tope * 1.6, 0.0, 1.0)


def preparar(ruta_guion: str, sin_voz: bool = False) -> dict:
    guion = cargar_guion(ruta_guion)
    escenas = guion.get("escenas", [])
    gid = guion["id"]

    clips = [None] * len(escenas) if sin_voz else clips_de_voz(gid, len(escenas))
    audios = [leer_audio(p) if p else None for p in clips]

    # 1) Duracion final de cada escena.
    duraciones: list[float] = []
    for escena, audio in zip(escenas, audios):
        pedida = float(escena.get("duracion") or 5)
        if audio is not None:
            necesaria = ANTES + len(audio) / SR + DESPUES
            duraciones.append(round(max(pedida, necesaria), 3))
        else:
            duraciones.append(round(pedida, 3))

    total = float(sum(duraciones))

    # 2) Pista de voz colocada en el arranque de cada escena.
    voz = np.zeros(int((total + 1.0) * SR))
    inicio = 0.0
    for dur, audio in zip(duraciones, audios):
        if audio is not None:
            i = int((inicio + ANTES) * SR)
            fin = min(len(voz), i + len(audio))
            voz[i:fin] += audio[: fin - i]
        inicio += dur

    pico_voz = float(np.max(np.abs(voz)))
    if pico_voz > 0:
        voz = voz / pico_voz * 0.86  # voz al frente, clara

    # 3) Musica del largo exacto.
    cfg = guion.get("musica") or {}
    estilo = cfg.get("estilo", "alegre")
    # crc32 y no hash(): hash() de str cambia entre procesos y romperia la reproducibilidad.
    semilla = int(cfg.get("semilla", zlib.crc32(gid.encode()) % 10_000))
    musica = generar(total + 1.0, estilo, semilla)
    musica = musica[: len(voz)]
    if len(musica) < len(voz):
        musica = np.pad(musica, (0, len(voz) - len(musica)))

    nivel_musica = float(cfg.get("volumen", 0.34))
    musica *= nivel_musica

    # 4) Ducking: la musica cede el paso a la voz.
    if pico_voz > 0:
        musica *= 1.0 - 0.72 * envolvente_voz(voz)

    mezcla = musica + voz
    pico = float(np.max(np.abs(mezcla))) or 1.0
    if pico > 0.97:
        mezcla = mezcla / pico * 0.97

    destino = RAIZ / "temporal" / gid
    destino.mkdir(parents=True, exist_ok=True)
    escribir_wav(destino / "audio.wav", mezcla)

    tiempos = {
        "id": gid,
        "duraciones": duraciones,
        "total": round(total, 3),
        "narracion": [str(p.relative_to(RAIZ)) if p else None for p in clips],
        "escenas_sin_voz": [i + 1 for i, p in enumerate(clips) if p is None],
    }
    with open(destino / "tiempos.json", "w", encoding="utf-8") as f:
        json.dump(tiempos, f, ensure_ascii=False, indent=2)

    return tiempos


def main() -> None:
    ap = argparse.ArgumentParser(description="Prepara audio y tiempos del video")
    ap.add_argument("--guion", required=True)
    ap.add_argument("--sin-voz", action="store_true", help="solo musica, ignora voz/")
    a = ap.parse_args()

    t = preparar(a.guion, a.sin_voz)
    con_voz = len(t["duraciones"]) - len(t["escenas_sin_voz"])
    print(f"audio listo: {t['total']:.1f}s | {con_voz}/{len(t['duraciones'])} escenas con narracion")
    if t["escenas_sin_voz"]:
        print(f"  escenas sin voz: {t['escenas_sin_voz']}  (corren con la duracion del guion)")


if __name__ == "__main__":
    main()
