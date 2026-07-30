# Fábrica de videos infantiles (2–4 años)

Genera videos animados en 1080p listos para subir a YouTube a partir de un
archivo JSON. Toda la imagen se dibuja con código (SVG + Chromium) y la música
se sintetiza aquí mismo, así que **no hay assets con licencia de terceros ni
riesgo de Content ID**.

```
guion (.json)  ──►  Chromium dibuja cada cuadro  ──►  ffmpeg (H.264 + AAC)  ──►  salida/*.mp4
                    audio: música sintetizada + narración
```

---

## 1. Instalación

```bash
cd videos-infantiles
npm install                      # playwright + tipografía Baloo 2
pip install numpy imageio-ffmpeg # síntesis de audio + ffmpeg completo
npx playwright install chromium  # solo si no tienes Chromium en el sistema
```

Requisitos: Node 18+, Python 3.10+, ~1 GB libre por video.

## 2. Hacer un video

```bash
# borrador rápido (media resolución, para revisar ritmo y textos)
node render.mjs --guion guiones/001-los-colores.json --escala 0.5 --crf 28

# revisar un instante puntual sin renderizar todo
node render.mjs --guion guiones/001-los-colores.json --fotos "3,11,54"

# versión final 1080p
node render.mjs --guion guiones/001-los-colores.json
```

Salidas en `salida/`: el `.mp4` y una miniatura `.jpg` de 1280×720 tomada de la
portada.

Tiempo de render: ~3 s de proceso por cada segundo de video en 1080p
(un video de 3 minutos toma unos 9 minutos).

### Opciones de `render.mjs`

| Opción | Para qué sirve |
|---|---|
| `--guion <ruta>` | guion a renderizar (obligatorio) |
| `--escala 0.5` | media resolución: 4× más rápido, para borradores |
| `--crf 20` | calidad (18 = mejor, 28 = liviano) |
| `--fps 30` | cuadros por segundo |
| `--fotos "3,11"` | solo exporta PNG en esos segundos, sin video |
| `--desde` / `--hasta` | renderiza un tramo en segundos |
| `--sin-voz` | ignora `voz/` y deja solo música |
| `--sin-audio` | video mudo |
| `--salida <ruta>` | ruta del mp4 |

## 3. El guion

Un video es una lista de escenas. La duración de cada escena se estira
automáticamente si la narración es más larga que lo declarado.

```json
{
  "id": "001-los-colores",
  "titulo": "APRENDE LOS COLORES",
  "canal": "Lulo y sus amigos",
  "fps": 30,
  "musica": { "estilo": "alegre", "volumen": 0.34, "semilla": 11 },
  "escenas": [
    { "tipo": "intro", "duracion": 6, "titulo": "LOS COLORES", "subtitulo": "con Lulo",
      "narracion": "Hola amiguitos..." },
    { "tipo": "presentar", "duracion": 9, "objeto": "manzana", "etiqueta": "ROJO",
      "color": "rojo", "narracion": "Mira. Una manzana..." }
  ]
}
```

### Tipos de escena

| tipo | qué muestra | campos propios |
|---|---|---|
| `intro` | portada con título y la mascota saludando | `titulo`, `subtitulo` |
| `presentar` | un objeto grande + su palabra en una pastilla | `objeto`, `etiqueta`, `color`, `sonido` |
| `contar` | aparecen N objetos uno por uno con el número | `objeto`, `hasta` (1–10), `color` |
| `pregunta` | 3 opciones, pausa, y se marca la correcta | `enunciado`, `opciones[]`, `correcta`, `revelarEn` |
| `celebrar` | confeti y la mascota festejando | `texto` |
| `repaso` | rejilla con todo lo aprendido (hasta 8) | `titulo`, `items[]` |
| `despedida` | cierre con el nombre del canal | `texto`, `canal` |

Campos comunes a todas: `duracion` (segundos), `narracion` (texto que se lee),
`fondo` (`pradera`, `cielo`, `arcoiris`, `cuarto`).

### Catálogo de objetos

**Animales:** `perro` `gato` `vaca` `pato` `leon` `elefante` `rana` `cerdo`
`oveja` `panda` `pollito` `pez` `abeja` — traen su onomatopeya automática
(GUAU, MIAU, MUUU…), se puede sobrescribir con `"sonido"`.

**Frutas:** `manzana` `banano` `uva` `naranja` `sandia` `fresa`

**Formas:** `circulo` `cuadrado` `triangulo` `rectangulo` `estrella` `corazon`
`rombo` `ovalo`

**Objetos:** `pelota` `globo` `carro` `bus` `avion` `barco` `tren` `sol` `nube`
`flor` `casa` `arbol`

Los que son de un solo color aceptan color: `"objeto": "pelota:azul"` o
`"color": "morado"`. Colores disponibles: `rojo` `azul` `amarillo` `verde`
`naranja` `morado` `rosado` `cafe` `negro` `blanco` `gris` (o cualquier `#hex`).

Para agregar un objeto nuevo: una función más en `src/assets/objetos.js`
(viewBox 200×200, trazo grueso oscuro, colores planos).

## 4. Audio

### Música
Se sintetiza con numpy sobre escala pentatonaria (nunca desafina) con marimba,
caja musical, bajo y maraca. Estilos: `alegre`, `juguetona`, `suave`, `arrullo`.
Con la misma `semilla` sale idéntica; cambiándola sale otra melodía.

```bash
python3 audio/musica.py --segundos 90 --estilo suave --salida temporal/prueba.wav
```

### Narración
Tres caminos, en orden de recomendación:

1. **Voz propia grabada** — la mejor opción para un canal infantil: es contenido
   original y suena cercana. Grabar una línea por escena y guardarlas como
   `voz/<id-guion>/01.wav`, `02.wav`, … El render ajusta la duración de cada
   escena a la grabación.
2. **Edge TTS** (gratis, voces neuronales, sin API key):
   ```bash
   python3 audio/voz.py --guion guiones/001-los-colores.json --voz es-CO-SalomeNeural
   ```
   Voces sugeridas: `es-CO-SalomeNeural`, `es-CO-GonzaloNeural`,
   `es-MX-DaliaNeural`.
   ⚠️ Este servidor tiene bloqueado `speech.platform.bing.com` por política de
   red, así que **este paso hay que correrlo en un computador propio**. Los
   `.mp3` resultantes se copian a `voz/<id-guion>/`.
3. **Piper** (neuronal, 100% local, sin internet): requiere descargar un modelo
   `.onnx` de voz española a `voz/modelos/` y usar `--motor piper`.

Los archivos que ya existen nunca se sobrescriben: se puede mezclar TTS con
líneas regrabadas a mano.

La mezcla final baja la música automáticamente cuando hay voz (ducking).

## 5. Publicar en YouTube

- Marcar el video como **hecho para niños** (obligatorio por COPPA cuando el
  público objetivo son menores). Consecuencia: YouTube desactiva comentarios,
  pantallas finales, tarjetas y anuncios personalizados. Por eso el llamado a
  suscribirse, si se quiere, va dibujado dentro del video.
- La miniatura ya sale en 1280×720 (`salida/<id>-miniatura.jpg`).
- `guion.youtube` guarda título, descripción y etiquetas sugeridas para no
  tener que reescribirlas al subir.

## 6. Criterios de diseño para 2–4 años

Lo que está aplicado en las plantillas, por si se agregan nuevas:

- **Un concepto por video.** Nada de mezclar colores con números.
- **Ritmo lento:** 8–10 s por objeto. Un niño de 2 años necesita ese tiempo
  para mirar, oír la palabra y repetirla.
- **Repetición explícita:** se nombra el objeto, se silabea y se repite.
- **Sin destellos ni cortes bruscos:** las transiciones son un fundido a crema
  de 0,4 s, nunca a blanco o negro puro, y nada parpadea rápido.
- **Alto contraste:** figuras con trazo oscuro grueso sobre fondos suaves.
- **Sin texto pequeño ni frases largas:** una sola palabra por pantalla.
- **Duración total sugerida:** 2–5 minutos.

## 7. Estructura

```
videos-infantiles/
├── render.mjs              orquestador: cuadros -> ffmpeg -> mp4
├── src/
│   ├── escena.html         página que Chromium renderiza (estilos)
│   ├── motor.js            plantillas de escena y función __ir(t)
│   ├── fuentes/            @font-face de Baloo 2
│   └── assets/
│       ├── objetos.js      catálogo de objetos en SVG
│       └── mascota.js      Lulo, la mascota animable
├── audio/
│   ├── musica.py           sintetizador de música original
│   ├── voz.py              narración (Edge TTS / Piper)
│   ├── preparar.py         tiempos + mezcla con ducking
│   └── comun.py            utilidades compartidas
├── guiones/                un JSON por video
├── voz/<id-guion>/         narración por escena (01.wav, 02.wav…)
├── temporal/               audio y tiempos intermedios
└── salida/                 mp4 y miniaturas
```

El render es determinista: el mismo guion produce exactamente el mismo video,
cuadro por cuadro. No se usan animaciones CSS ni `Math.random()` sin semilla.
