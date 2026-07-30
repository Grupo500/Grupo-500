#!/usr/bin/env python3
"""
Genera la narracion de cada escena a partir del campo "narracion" del guion.

Motores soportados:
  edge   Voces neuronales de Microsoft Edge (gratis, sin API key).
         Requiere salida a speech.platform.bing.com.
  piper  Motor neuronal local (sin internet), necesita un modelo .onnx descargado.

Salida: voz/<id-guion>/01.mp3, 02.mp3, ...
Si ya existe un archivo para una escena no se sobrescribe, asi puedes reemplazar
cualquier linea por una grabacion propia (voz/<id>/03.wav) y volver a correr todo.

Uso:
    python3 audio/voz.py --guion guiones/001-los-colores.json
    python3 audio/voz.py --guion guiones/001-los-colores.json --voz es-CO-GonzaloNeural
    python3 audio/voz.py --guion guiones/001-los-colores.json --motor piper --modelo voz/modelos/es_MX-claude-high.onnx
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
from pathlib import Path

from comun import RAIZ, cargar_guion

# Voces recomendadas para publico infantil hispanohablante.
VOCES = {
    "es-CO-SalomeNeural": "Colombia, femenina, calida (recomendada)",
    "es-CO-GonzaloNeural": "Colombia, masculina",
    "es-MX-DaliaNeural": "Mexico, femenina, muy clara",
    "es-MX-JorgeNeural": "Mexico, masculina",
    "es-ES-ElviraNeural": "Espana, femenina",
}


async def _generar_edge(lineas: list[tuple[int, str]], carpeta: Path, voz: str,
                        velocidad: str, tono: str) -> list[Path]:
    import edge_tts

    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    hechos = []
    for numero, texto in lineas:
        destino = carpeta / f"{numero:02d}.mp3"
        com = edge_tts.Communicate(texto, voz, rate=velocidad, pitch=tono, proxy=proxy)
        await com.save(str(destino))
        if destino.stat().st_size == 0:
            destino.unlink(missing_ok=True)
            raise RuntimeError("el servicio devolvio audio vacio")
        hechos.append(destino)
        print(f"  {numero:02d}  {texto[:58]}")
    return hechos


def _generar_piper(lineas: list[tuple[int, str]], carpeta: Path, modelo: str) -> list[Path]:
    if not Path(modelo).exists():
        raise RuntimeError(
            f"No existe el modelo {modelo}.\n"
            "Descarga una voz de piper (es_MX-claude-high) desde\n"
            "  https://huggingface.co/rhasspy/piper-voices/tree/main/es\n"
            "y guardala junto con su .onnx.json en voz/modelos/."
        )
    hechos = []
    for numero, texto in lineas:
        destino = carpeta / f"{numero:02d}.wav"
        subprocess.run(
            [sys.executable, "-m", "piper", "--model", modelo, "--output_file", str(destino)],
            input=texto.encode("utf-8"), check=True,
        )
        hechos.append(destino)
        print(f"  {numero:02d}  {texto[:58]}")
    return hechos


def main() -> None:
    ap = argparse.ArgumentParser(description="Genera la narracion del guion")
    ap.add_argument("--guion", required=True)
    ap.add_argument("--motor", default="edge", choices=["edge", "piper"])
    ap.add_argument("--voz", default="es-CO-SalomeNeural")
    ap.add_argument("--velocidad", default="-10%", help="mas lento ayuda a los mas pequenos")
    ap.add_argument("--tono", default="+10Hz")
    ap.add_argument("--modelo", default="voz/modelos/es_MX-claude-high.onnx")
    ap.add_argument("--sobrescribir", action="store_true")
    a = ap.parse_args()

    guion = cargar_guion(a.guion)
    carpeta = RAIZ / "voz" / guion["id"]
    carpeta.mkdir(parents=True, exist_ok=True)

    existentes = {p.stem for p in carpeta.glob("*.*")}
    pendientes: list[tuple[int, str]] = []
    for i, escena in enumerate(guion.get("escenas", []), start=1):
        texto = (escena.get("narracion") or "").strip()
        if not texto:
            continue
        if not a.sobrescribir and f"{i:02d}" in existentes:
            print(f"  {i:02d}  (ya existe, se conserva)")
            continue
        pendientes.append((i, texto))

    if not pendientes:
        print("No hay lineas nuevas por generar.")
        return

    print(f"Generando {len(pendientes)} lineas con motor '{a.motor}'...")
    try:
        if a.motor == "edge":
            asyncio.run(_generar_edge(pendientes, carpeta, a.voz, a.velocidad, a.tono))
        else:
            _generar_piper(pendientes, carpeta, a.modelo)
    except Exception as e:
        print(f"\nFALLO la generacion de voz: {type(e).__name__}: {e}", file=sys.stderr)
        print(
            "\nOpciones:\n"
            "  1. Correr este mismo comando en tu computador (el servicio de Edge es gratuito).\n"
            "  2. Grabar tu propia voz y guardarla como "
            f"voz/{guion['id']}/01.wav, 02.wav, ... (una por escena).\n"
            "  3. Usar --motor piper con un modelo local descargado.\n"
            "El video se puede renderizar sin voz mientras tanto: node render.mjs --guion "
            f"{a.guion} --sin-voz",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\nListo. Ahora: node render.mjs --guion {a.guion}")


if __name__ == "__main__":
    main()
