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

### Todo de una vez

`producir.mjs` hace la narración y el render de cada guion, uno tras otro. Si
uno falla sigue con el siguiente y reporta al final:

```bash
export GOOGLE_TTS_API_KEY=...
node producir.mjs                                    # todos los guiones
node producir.mjs --guion guiones/101-colores-compilado.json
node producir.mjs --sin-voz --escala 0.5              # borradores mudos
```

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

## 3. Compilados de 15–30 minutos

Un compilado tiene más de 100 escenas, así que se generan con un script en vez
de escribirlos a mano:

```bash
node guiones/armar.mjs --tema colores --minutos 20
node guiones/armar.mjs --todos --minutos 20      # los cuatro temas de una vez
```

Temas disponibles: `colores`, `formas`, `numeros`, `frutas-vehiculos`.

Cada tema se arma en **rondas**: presentar → presentar → pregunta, y cada ronda
rota los objetos, de modo que la repetición (que a esta edad refuerza el
aprendizaje) no sea literalmente la misma escena dos veces. El script agrega
rondas hasta acercarse a los minutos pedidos e intercala repasos.

La narración bilingüe sale ya redactada, con la concordancia de género correcta
en español (*la manzana es roja* / *el carro es rojo*).

Para agregar un tema nuevo o cambiar los textos: los datos y las plantillas de
narración están en `guiones/armar.mjs`.

> Un compilado de 20 min tarda cerca de una hora en renderizar en 1080p. Para
> revisar antes de comprometer ese tiempo: `--escala 0.5 --hasta 180`.

## 4. El guion

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
| `presentar` | un objeto grande + su palabra en una pastilla | `objeto`, `etiqueta`, `etiquetaEn`, `color`, `sonido` |
| `contar` | aparecen N objetos uno por uno con el número | `objeto`, `hasta` (1–10), `palabra`, `palabraEn`, `color` |
| `pregunta` | 3 opciones, pausa, y se marca la correcta | `enunciado`, `opciones[]`, `correcta`, `revelarEn` |
| `celebrar` | confeti y la mascota festejando | `texto` |
| `repaso` | rejilla con todo lo aprendido (hasta 8) | `titulo`, `items[]` |
| `despedida` | cierre con el nombre del canal | `texto`, `canal` |

Campos comunes a todas: `duracion` (segundos), `narracion` (texto o lista de
segmentos bilingües), `fondo` (`pradera`, `cielo`, `arcoiris`, `cuarto`).

Los campos que terminan en `En` son la palabra en inglés: aparece debajo de la
española, más pequeña y en azul, y entra unos segundos después para no competir
con ella. En `pregunta`, `revelarEn` menor o igual a 1 se interpreta como
fracción de la escena, así la respuesta sigue cuadrando si la narración estira
la duración.

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

## 5. Audio

### Música
Se sintetiza con numpy sobre escala pentatonaria (nunca desafina) con marimba,
caja musical, bajo y maraca. Estilos: `alegre`, `juguetona`, `suave`, `arrullo`.
Con la misma `semilla` sale idéntica; cambiándola sale otra melodía.

```bash
python3 audio/musica.py --segundos 90 --estilo suave --salida temporal/prueba.wav
```

### Narración

**Google Cloud TTS (`--motor google`) — el único servicio de voz con IA que
funciona desde este servidor.** Los demás (Edge, ElevenLabs, OpenAI, Azure,
Deepgram) están bloqueados por la política de red del entorno.

```bash
export GOOGLE_TTS_API_KEY=...
python3 audio/voz.py --guion guiones/101-colores-compilado.json
python3 audio/voz.py --listar-voces          # ver todas las voces disponibles
```

Cómo obtener la key: `console.cloud.google.com` → crear proyecto → habilitar
**Cloud Text-to-Speech API** → APIs y servicios → Credenciales → Crear clave de
API. Las voces Neural2 traen 1 millón de caracteres gratis al mes; un compilado
de 20 minutos consume unos 7 mil, así que alcanza de sobra.

Otras opciones, todas compatibles con el mismo pipeline:

- **Voz propia grabada** — grabar una línea por escena y guardarla como
  `voz/<id-guion>/01.wav`, `02.wav`, … El render ajusta la duración de cada
  escena a la grabación.
- **Edge TTS** (`--motor edge`, gratis y sin key), pero hay que correrlo en un
  computador propio y copiar los audios a `voz/<id-guion>/`.
- **Piper** (`--motor piper`, 100% local): requiere bajar un modelo `.onnx` de
  voz española a `voz/modelos/`.

Los archivos que ya existen nunca se sobrescriben, así que se puede mezclar TTS
con líneas regrabadas a mano.

**Narración bilingüe:** el campo `narracion` acepta una lista de segmentos con
su idioma. Cada segmento se sintetiza con una voz de ese idioma y se unen en un
solo audio por escena, con una pausa corta en medio.

```json
"narracion": [
  { "idioma": "es", "texto": "Mira. Una manzana. La manzana es roja. Rojo." },
  { "idioma": "en", "texto": "Red. A red apple." }
]
```

La mezcla final baja la música automáticamente cuando hay voz (ducking).

## 6. Publicar en YouTube

- Marcar el video como **hecho para niños** (obligatorio por COPPA cuando el
  público objetivo son menores). Consecuencia: YouTube desactiva comentarios,
  pantallas finales, tarjetas y anuncios personalizados. Por eso el llamado a
  suscribirse, si se quiere, va dibujado dentro del video.
- La miniatura ya sale en 1280×720 (`salida/<id>-miniatura.jpg`).
- `guion.youtube` guarda título, descripción y etiquetas sugeridas para no
  tener que reescribirlas al subir.

## 7. Criterios de diseño para 2–4 años

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

## 8. Estructura

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
