"use client";

// Render compartido del texto de preguntas del simulacro (estudiante y preview admin):
// - Citas bibliográficas (Tomado de / Fuente:) con formato de cita: pequeñas,
//   alineadas a la izquierda, en cursiva, nunca en negrita
// - Listas (Primero. / Paso 1. / Afirmación 1.) en renglones aparte con el prefijo en negrita
// - La pregunta (¿...?) en renglón aparte, SIN negrita
// - Cuerpo del texto justificado
// - Operaciones/ecuaciones centradas y en cursiva
// - Orden con imagen: enunciado (intro) → imagen → pregunta → opciones

const RE_CITA = /^\s*(Tomado y adaptado de|Tomado de|Adaptado de|Recuperado de|Fuente)\s*:?/i;
const RE_LISTA = /^\s*(Primero|Segundo|Tercero|Cuarto|Quinto|Paso\s+\d+|Afirmación\s+\d+)\s*[.:]\s*/;

// Detecta si un párrafo es texto de tabla extraído del PDF (filas de números/columnas)
export function esParrafoTabla(p: string): boolean {
  const t = p.trim();
  if (/^Tabla\s*$/i.test(t)) return true;
  const tokens = t.split(/\s+/);
  if (tokens.length < 5) return false;
  const nums = tokens.filter(tok =>
    /^[\d.,]+%?$/.test(tok) ||
    /^\$[\d.,]+$/.test(tok) ||
    /^\d{4}$/.test(tok)
  );
  const ratio = nums.length / tokens.length;
  if (ratio > 0.28) return true;
  if (/\d\.\d{3}/.test(t) && ratio > 0.18) return true;
  return false;
}

// Ecuación/operación aislada: empieza con dígito o paréntesis y contiene "="
function esEcuacion(t: string): boolean {
  return /^[\d(]/.test(t) && t.includes("=") && t.length < 160 && !t.includes("¿");
}

// Separa las citas y los ítems de lista que vienen pegados dentro de un párrafo
function normalizar(texto: string): string[] {
  const conCortes = texto
    .replace(/\n(?=\s*(Tomado y adaptado de|Tomado de|Adaptado de|Fuente\s*:))/gi, "\n\n")
    .replace(/\n(?=\s*(Primero|Segundo|Tercero|Cuarto|Quinto)\s*[.:])/g, "\n\n")
    .replace(/\n(?=\s*(Paso|Afirmación)\s+\d+\s*[.:])/gi, "\n\n");
  return conCortes.split("\n\n").map(p => p.trim()).filter(Boolean);
}

type Bloque =
  | { tipo: "cita" | "lista" | "ecuacion" | "texto" | "pregunta"; contenido: string };

// Convierte párrafos en bloques tipados; los párrafos que contienen "¿" se parten
// en (texto previo) + (pregunta en renglón aparte)
function aBloques(parrafos: string[]): Bloque[] {
  const bloques: Bloque[] = [];
  for (const p of parrafos) {
    if (RE_CITA.test(p)) { bloques.push({ tipo: "cita", contenido: p }); continue; }
    if (RE_LISTA.test(p)) { bloques.push({ tipo: "lista", contenido: p }); continue; }
    if (esEcuacion(p)) { bloques.push({ tipo: "ecuacion", contenido: p }); continue; }
    const i = p.indexOf("¿");
    if (i > 0) {
      bloques.push({ tipo: "texto", contenido: p.slice(0, i).trim() });
      bloques.push({ tipo: "pregunta", contenido: p.slice(i).trim() });
    } else if (i === 0) {
      bloques.push({ tipo: "pregunta", contenido: p });
    } else {
      bloques.push({ tipo: "texto", contenido: p });
    }
  }
  return bloques;
}

function RenderBloque({ b, primero }: { b: Bloque; primero: boolean }) {
  const base: React.CSSProperties = { margin: primero ? 0 : "10px 0 0", lineHeight: 1.7 };
  switch (b.tipo) {
    case "cita":
      return (
        <p style={{ ...base, fontSize: ".76rem", color: "var(--gris)", textAlign: "left", fontStyle: "italic", lineHeight: 1.5 }}>
          {b.contenido}
        </p>
      );
    case "lista": {
      const m = b.contenido.match(RE_LISTA)!;
      const prefijo = m[0].trim().replace(/[:]$/, ".");
      const resto = b.contenido.slice(m[0].length);
      return (
        <p style={{ ...base, textAlign: "justify" }}>
          <strong>{prefijo}</strong> {resto}
        </p>
      );
    }
    case "ecuacion":
      return <p style={{ ...base, textAlign: "center", fontStyle: "italic" }}>{b.contenido}</p>;
    case "pregunta":
      return <p style={{ ...base, marginTop: primero ? 0 : 12 }}>{b.contenido}</p>;
    default:
      return <p style={{ ...base, textAlign: "justify" }}>{b.contenido}</p>;
  }
}

// Texto corrido (contextos de lectura). Citas y listas con su formato.
export function TextoConParrafos({ texto, style }: { texto: string; style?: React.CSSProperties }) {
  const bloques = aBloques(normalizar(texto));
  return (
    <div style={style}>
      {bloques.map((b, i) => <RenderBloque key={i} b={b} primero={i === 0} />)}
    </div>
  );
}

// Enunciado de pregunta con orden: intro → imagen → pregunta.
// Si hay imagen, se filtran los párrafos que son volcado de tabla (ya están en la imagen).
export function EnunciadoConImagen({
  texto,
  imagenUrl,
  numero,
}: {
  texto: string;
  imagenUrl: string | null;
  numero: number;
}) {
  const parrafos = normalizar(texto).filter(p => !imagenUrl || !esParrafoTabla(p));
  const bloques = aBloques(parrafos);

  const img = imagenUrl && (
    <div style={{ margin: "14px 0" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagenUrl}
        alt={`Figura pregunta ${numero}`}
        style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid var(--linea)" }}
      />
    </div>
  );

  if (!imagenUrl) {
    return (
      <div>
        {bloques.map((b, i) => <RenderBloque key={i} b={b} primero={i === 0} />)}
      </div>
    );
  }

  // Último bloque de tipo "pregunta": desde ahí (inclusive) va DESPUÉS de la imagen
  let idxPregunta = -1;
  for (let i = bloques.length - 1; i >= 0; i--) {
    if (bloques[i].tipo === "pregunta") { idxPregunta = i; break; }
  }

  const antes = idxPregunta >= 0 ? bloques.slice(0, idxPregunta) : bloques;
  const despues = idxPregunta >= 0 ? bloques.slice(idxPregunta) : [];

  return (
    <div>
      {antes.map((b, i) => <RenderBloque key={`a${i}`} b={b} primero={i === 0} />)}
      {img}
      {despues.map((b, i) => <RenderBloque key={`d${i}`} b={b} primero={false} />)}
    </div>
  );
}
