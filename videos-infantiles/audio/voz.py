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
  elevenlabs  La mejor calidad. Necesita ELEVENLABS_API_KEY. El modelo
              multilingue pronuncia bien espanol e ingles con la misma voz, asi
              que el video bilingue queda con un solo narrador.
              api.elevenlabs.io esta bloqueado en el servidor de Claude Code:
              correr en equipo propio.
  google      Google Cloud Text-to-Speech. Necesita GOOGLE_TTS_API_KEY.
              Es el unico servicio de voz con IA alcanzable desde ese servidor.
  edge        Voces neuronales de Microsoft Edge (gratis, sin key), pero
              speech.platform.bing.com tambien esta bloqueado alli.
  piper       Motor neuronal local, sin internet. Requiere modelo .onnx.

Salida: voz/<id-guion>/01.wav, 02.wav, ...
Los archivos que ya existen no se sobrescriben, asi que se puede reemplazar
cualquier linea por una grabacion propia y volver a correr todo.

Uso:
    export ELEVENLABS_API_KEY=...
    python3 audio/voz.py --guion guiones/101-colores-compilado.json --motor elevenlabs
    python3 audio/voz.py --motor elevenlabs --listar-voces

    export GOOGLE_TTS_API_KEY=...
    python3 audio/voz.py --guion guiones/001-los-colores.json --motor google
    python3 audio/voz.py --guion ... --voz-es es-US-Neural2-A --voz-en en-US-Neural2-F
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

ELEVEN_URL = "https://api.elevenlabs.io/v1"
# El modelo multilingue maneja los dos idiomas con la misma voz, que es lo que
# hace que el video bilingue no suene como dos narradores distintos.
ELEVEN_MODELO = "eleven_multilingual_v2"


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


# ---------------------------------------------------------------- ElevenLabs

def _pedir_eleven(ruta: str, clave: str, cuerpo: dict | None = None) -> bytes:
    pedido = urllib.request.Request(
        f"{ELEVEN_URL}/{ruta}",
        data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
        headers={"xi-api-key": clave, "Content-Type": "application/json"},
        method="POST" if cuerpo is not None else "GET",
    )
    try:
        with urllib.request.urlopen(pedido, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detalle = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"ElevenLabs respondio {e.code}: {detalle}") from None


def voces_eleven(clave: str) -> list[dict]:
    datos = json.loads(_pedir_eleven("voices", clave))
    return datos.get("voices", [])


def listar_voces_eleven(clave: str) -> None:
    voces = voces_eleven(clave)
    print(f"{len(voces)} voces en la cuenta:\n")
    for v in voces:
        etiquetas = v.get("labels") or {}
        detalle = ", ".join(f"{k}={x}" for k, x in etiquetas.items() if k in
                            ("gender", "age", "accent", "description", "use_case"))
        print(f"  {v['voice_id']}  {v.get('name', ''):22} {detalle}")
    print("\nElegir con: --voz-es <voice_id>  (y --voz-en si se quiere otra para el ingles)")


def voz_eleven(texto: str, voice_id: str, clave: str, velocidad: float,
               modelo: str = ELEVEN_MODELO) -> np.ndarray:
    ajustes = {"stability": 0.45, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}
    if abs(velocidad - 1.0) > 0.01:
        ajustes["speed"] = round(max(0.7, min(1.2, velocidad)), 2)

    cuerpo = {"text": texto, "model_id": modelo, "voice_settings": ajustes}
    try:
        crudo = _pedir_eleven(f"text-to-speech/{voice_id}?output_format=mp3_44100_128", clave, cuerpo)
    except RuntimeError as e:
        # Algunos modelos no aceptan "speed": se reintenta sin ese ajuste antes
        # de darse por vencido, para no fallar por un detalle de configuracion.
        if "speed" in str(e) and "speed" in ajustes:
            ajustes.pop("speed")
            cuerpo["voice_settings"] = ajustes
            crudo = _pedir_eleven(f"text-to-speech/{voice_id}?output_format=mp3_44100_128", clave, cuerpo)
        else:
            raise

    tmp = RAIZ / "temporal" / "_voz_tmp.mp3"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(crudo)
    audio = leer_audio(tmp)
    tmp.unlink(missing_ok=True)
    return audio


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
    ap.add_argument("--motor", default="google", choices=["elevenlabs", "google", "edge", "piper"])
    ap.add_argument("--voz-es", default=None,
                    help="google: nombre de voz. elevenlabs: voice_id")
    ap.add_argument("--voz-en", default=None,
                    help="si se omite en elevenlabs se usa la misma voz (el modelo es multilingue)")
    ap.add_argument("--velocidad", type=float, default=0.88,
                    help="1.0 es normal; mas lento ayuda a los mas pequenos")
    ap.add_argument("--tono", type=float, default=2.0, help="google: semitonos")
    ap.add_argument("--modelo", default=None,
                    help="elevenlabs: model_id. piper: ruta al .onnx")
    ap.add_argument("--sobrescribir", action="store_true")
    ap.add_argument("--listar-voces", action="store_true")
    a = ap.parse_args()

    clave_google = os.environ.get("GOOGLE_TTS_API_KEY", "")
    clave_eleven = os.environ.get("ELEVENLABS_API_KEY", "")

    if a.listar_voces:
        try:
            if a.motor == "elevenlabs":
                if not clave_eleven:
                    sys.exit("Falta ELEVENLABS_API_KEY.")
                listar_voces_eleven(clave_eleven)
            else:
                if not clave_google:
                    sys.exit("Falta GOOGLE_TTS_API_KEY para listar voces.")
                listar_voces_google(clave_google)
        except (urllib.error.URLError, RuntimeError) as e:
            sys.exit(
                f"No se pudo consultar las voces: {e}\n\n"
                "Si el mensaje dice 'Tunnel connection failed: 403', el host esta\n"
                "bloqueado por la politica de red de este equipo. Corre este comando\n"
                "en tu computador personal."
            )
        return

    if not a.guion:
        sys.exit("Falta --guion <ruta>")

    guion = cargar_guion(a.guion)
    carpeta = RAIZ / "voz" / guion["id"]
    carpeta.mkdir(parents=True, exist_ok=True)

    if a.motor == "google" and not clave_google:
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

    if a.motor == "elevenlabs" and not clave_eleven:
        sys.exit(
            "Falta la variable ELEVENLABS_API_KEY.\n\n"
            "  export ELEVENLABS_API_KEY=...\n"
            "  python3 audio/voz.py --motor elevenlabs --listar-voces\n\n"
            "OJO: ElevenLabs cobra por caracteres. Los cuatro compilados suman unos\n"
            "51 mil caracteres, asi que conviene revisar el plan antes de lanzarlos."
        )

    # Resolucion de voces por motor.
    if a.motor == "elevenlabs":
        voz_es = a.voz_es
        if not voz_es:
            disponibles = voces_eleven(clave_eleven)
            if not disponibles:
                sys.exit("La cuenta de ElevenLabs no tiene voces disponibles.")
            voz_es = disponibles[0]["voice_id"]
            print(f"Voz no indicada, se usa '{disponibles[0].get('name')}' ({voz_es}).")
            print("Para elegir otra: --motor elevenlabs --listar-voces")
        voces = {"es": voz_es, "en": a.voz_en or voz_es}
    else:
        voces = {
            "es": a.voz_es or VOZ_POR_DEFECTO["es"],
            "en": a.voz_en or VOZ_POR_DEFECTO["en"],
        }

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

    silencio = np.zeros(int(PAUSA * SR))
    modelo_piper = a.modelo or "voz/modelos/es_MX-claude-high.onnx"

    try:
        for numero, segs in pendientes:
            partes = []
            for s in segs:
                idioma = s["idioma"] if s["idioma"] in voces else "es"
                if a.motor == "elevenlabs":
                    audio = voz_eleven(s["texto"], voces[idioma], clave_eleven,
                                       a.velocidad, a.modelo or ELEVEN_MODELO)
                elif a.motor == "google":
                    audio = voz_google(s["texto"], voces[idioma],
                                       IDIOMA_A_CODIGO[idioma], clave_google,
                                       a.velocidad, a.tono)
                elif a.motor == "edge":
                    audio = asyncio.run(voz_edge(s["texto"], VOCES_EDGE[idioma],
                                                 f"{int((a.velocidad - 1) * 100):+d}%",
                                                 f"{int(a.tono * 5):+d}Hz"))
                else:
                    audio = voz_piper(s["texto"], modelo_piper)
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
