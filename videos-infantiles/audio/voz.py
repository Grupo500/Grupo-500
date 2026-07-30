#!/usr/bin/env python3
"""
Genera la narracion de cada escena a partir del campo "narracion" del guion.

El campo puede ser un texto simple (se lee en espanol) o una lista de segmentos
con su idioma, que es lo que permite los videos bilingues:

    "narracion": [
      {"idioma": "es", "texto": "Mira. Una manzana. La manzana es roja."},
      {"idioma": "en", "texto": "Red. Red apple."}
    ]

Cada segmento se sintetiza con una voz del idioma correspondiente y luego se
unen en un solo archivo por escena, con una pausa corta en medio.

Motores:
  google  Google Cloud Text-to-Speech. Necesita GOOGLE_TTS_API_KEY.
          Es el unico servicio de voz con IA alcanzable desde este servidor.
  edge    Voces neuronales de Microsoft Edge (gratis, sin key), pero
          speech.platform.bing.com esta bloqueado aqui: correr en equipo propio.
  piper   Motor neuronal local, sin internet. Requiere modelo .onnx descargado.

Salida: voz/<id-guion>/01.wav, 02.wav, ...
Los archivos que ya existen no se sobrescriben, asi que se puede reemplazar
cualquier linea por una grabacion propia y volver a correr todo.

Uso:
    export GOOGLE_TTS_API_KEY=...
    python3 audio/voz.py --guion guiones/001-los-colores.json
    python3 audio/voz.py --guion ... --voz-es es-US-Neural2-A --voz-en en-US-Neural2-F
    python3 audio/voz.py --guion ... --listar-voces
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

from comun import RAIZ, SR, cargar_guion, leer_audio
from musica import escribir_wav

GOOGLE_URL = "https://texttospeech.googleapis.com/v1"

# Pausa entre segmentos de distinto idioma.
PAUSA = 0.35

# Voces por defecto: calidas y claras, buenas para publico infantil.
VOZ_POR_DEFECTO = {"es": "es-US-Neural2-A", "en": "en-US-Neural2-F"}
IDIOMA_A_CODIGO = {"es": "es-US", "en": "en-US"}

VOCES_EDGE = {
    "es": "es-CO-SalomeNeural",
    "en": "en-US-AriaNeural",
}


def segmentos_de(escena: dict) -> list[dict]:
    """Normaliza el campo narracion a una lista [{idioma, texto}, ...]."""
    bruto = escena.get("narracion")
    if not bruto:
        return []
    if isinstance(bruto, str):
        return [{"idioma": "es", "texto": bruto.strip()}]
    salida = []
    for s in bruto:
        if isinstance(s, str):
            salida.append({"idioma": "es", "texto": s.strip()})
        else:
            texto = (s.get("texto") or "").strip()
            if texto:
                salida.append({"idioma": s.get("idioma", "es"), "texto": texto})
    return salida


# ---------------------------------------------------------------- Google Cloud

def _pedir_google(ruta: str, cuerpo: dict | None, clave: str) -> dict:
    url = f"{GOOGLE_URL}/{ruta}"
    sep = "&" if "?" in url else "?"
    url = f"{url}{sep}key={clave}"
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    pedido = urllib.request.Request(
        url, data=datos, headers={"Content-Type": "application/json"},
        method="POST" if cuerpo is not None else "GET",
    )
    try:
        with urllib.request.urlopen(pedido, timeout=90) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detalle = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"Google TTS respondio {e.code}: {detalle}") from None


def voz_google(texto: str, voz: str, codigo: str, clave: str,
               velocidad: float, tono: float) -> np.ndarray:
    respuesta = _pedir_google("text:synthesize", {
        "input": {"text": texto},
        "voice": {"languageCode": codigo, "name": voz},
        "audioConfig": {
            "audioEncoding": "LINEAR16",
            "sampleRateHertz": SR,
            "speakingRate": velocidad,
            "pitch": tono,
        },
    }, clave)
    crudo = base64.b64decode(respuesta["audioContent"])
    tmp = RAIZ / "temporal" / "_voz_tmp.wav"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(crudo)
    audio = leer_audio(tmp)
    tmp.unlink(missing_ok=True)
    return audio


def listar_voces_google(clave: str) -> None:
    for codigo in ("es-US", "es-ES", "en-US"):
        datos = _pedir_google(f"voices?languageCode={codigo}", None, clave)
        nombres = sorted(v["name"] for v in datos.get("voices", []))
        print(f"\n{codigo}  ({len(nombres)} voces)")
        for n in nombres:
            print(f"  {n}")


# ---------------------------------------------------------------------- Edge

async def voz_edge(texto: str, voz: str, velocidad: str, tono: str) -> np.ndarray:
    import edge_tts

    tmp = RAIZ / "temporal" / "_voz_tmp.mp3"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    com = edge_tts.Communicate(texto, voz, rate=velocidad, pitch=tono,
                               proxy=os.environ.get("HTTPS_PROXY"))
    await com.save(str(tmp))
    audio = leer_audio(tmp)
    tmp.unlink(missing_ok=True)
    return audio


# --------------------------------------------------------------------- Piper

def voz_piper(texto: str, modelo: str) -> np.ndarray:
    if not Path(modelo).exists():
        raise RuntimeError(
            f"No existe el modelo {modelo}. Descarga una voz de piper desde\n"
            "  https://huggingface.co/rhasspy/piper-voices/tree/main/es\n"
            "y guardala junto con su .onnx.json en voz/modelos/."
        )
    tmp = RAIZ / "temporal" / "_voz_tmp.wav"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [sys.executable, "-m", "piper", "--model", modelo, "--output_file", str(tmp)],
        input=texto.encode("utf-8"), check=True,
    )
    audio = leer_audio(tmp)
    tmp.unlink(missing_ok=True)
    return audio


# ---------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description="Genera la narracion del guion")
    ap.add_argument("--guion")
    ap.add_argument("--motor", default="google", choices=["google", "edge", "piper"])
    ap.add_argument("--voz-es", default=VOZ_POR_DEFECTO["es"])
    ap.add_argument("--voz-en", default=VOZ_POR_DEFECTO["en"])
    ap.add_argument("--velocidad", type=float, default=0.88,
                    help="google: 1.0 es normal, mas lento ayuda a los mas pequenos")
    ap.add_argument("--tono", type=float, default=2.0, help="google: semitonos")
    ap.add_argument("--modelo", default="voz/modelos/es_MX-claude-high.onnx")
    ap.add_argument("--sobrescribir", action="store_true")
    ap.add_argument("--listar-voces", action="store_true")
    a = ap.parse_args()

    clave = os.environ.get("GOOGLE_TTS_API_KEY", "")

    if a.listar_voces:
        if not clave:
            sys.exit("Falta GOOGLE_TTS_API_KEY para listar voces.")
        listar_voces_google(clave)
        return

    if not a.guion:
        sys.exit("Falta --guion <ruta>")

    guion = cargar_guion(a.guion)
    carpeta = RAIZ / "voz" / guion["id"]
    carpeta.mkdir(parents=True, exist_ok=True)

    if a.motor == "google" and not clave:
        sys.exit(
            "Falta la variable GOOGLE_TTS_API_KEY.\n\n"
            "Como obtenerla:\n"
            "  1. console.cloud.google.com -> crear proyecto\n"
            "  2. Habilitar 'Cloud Text-to-Speech API'\n"
            "  3. APIs y servicios -> Credenciales -> Crear clave de API\n"
            "  4. export GOOGLE_TTS_API_KEY=...\n\n"
            "Las voces Neural2 tienen 1 millon de caracteres gratis al mes; un video\n"
            "de 20 minutos usa cerca de 7 mil, asi que alcanza de sobra."
        )

    existentes = {p.stem for p in carpeta.glob("*.*")}
    pendientes = []
    for i, escena in enumerate(guion.get("escenas", []), start=1):
        segs = segmentos_de(escena)
        if not segs:
            continue
        if not a.sobrescribir and f"{i:02d}" in existentes:
            continue
        pendientes.append((i, segs))

    saltadas = len(existentes)
    if not pendientes:
        print(f"No hay lineas nuevas por generar ({saltadas} ya existen).")
        return

    print(f"Generando {len(pendientes)} escenas con motor '{a.motor}'"
          + (f" ({saltadas} ya existian)" if saltadas else "") + "...")

    voces = {'es': a.voz_es, 'en': a.voz_en}
    silencio = np.zeros(int(PAUSA * SR))

    try:
        for numero, segs in pendientes:
            partes = []
            for s in segs:
                idioma = s["idioma"] if s["idioma"] in voces else "es"
                if a.motor == "google":
                    audio = voz_google(s["texto"], voces[idioma],
                                       IDIOMA_A_CODIGO[idioma], clave,
                                       a.velocidad, a.tono)
                elif a.motor == "edge":
                    audio = asyncio.run(voz_edge(s["texto"], VOCES_EDGE[idioma],
                                                 f"{int((a.velocidad - 1) * 100):+d}%",
                                                 f"{int(a.tono * 5):+d}Hz"))
                else:
                    audio = voz_piper(s["texto"], a.modelo)
                partes.append(audio)

            completo = partes[0]
            for p in partes[1:]:
                completo = np.concatenate([completo, silencio, p])

            escribir_wav(carpeta / f"{numero:02d}.wav", completo, estereo=False)
            resumen = " | ".join(f"[{s['idioma']}] {s['texto'][:34]}" for s in segs)
            print(f"  {numero:02d}  {len(completo)/SR:5.1f}s  {resumen}")

    except Exception as e:
        print(f"\nFALLO la generacion de voz: {type(e).__name__}: {e}", file=sys.stderr)
        print(
            "\nAlternativas:\n"
            "  - Grabar tu voz y guardarla como "
            f"voz/{guion['id']}/01.wav, 02.wav, ...\n"
            "  - Correr con --motor edge en tu computador (gratis, sin key).\n"
            f"  - Renderizar sin voz por ahora: node render.mjs --guion {a.guion} --sin-voz",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\nListo. Ahora: node render.mjs --guion {a.guion}")


if __name__ == "__main__":
    main()
