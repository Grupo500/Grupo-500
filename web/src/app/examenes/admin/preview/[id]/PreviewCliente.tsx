"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Pregunta = {
  id: number;
  numero: number;
  area: string;
  contexto: string | null;
  enunciado: string;
  opcion_a: string | null;
  opcion_b: string | null;
  opcion_c: string | null;
  opcion_d: string | null;
  opcion_e: string | null;
  opcion_f: string | null;
  opcion_g: string | null;
  opcion_h: string | null;
  imagen_url: string | null;
  correcta: string;
};

function TextoConParrafos({ texto, style }: { texto: string; style?: React.CSSProperties }) {
  const parrafos = texto.split('\n\n').filter(Boolean);
  return (
    <div style={style}>
      {parrafos.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0', lineHeight: 1.7, fontSize: "1rem" }}>
          {p.trim()}
        </p>
      ))}
    </div>
  );
}

function esParrafoTabla(p: string): boolean {
  const t = p.trim();
  if (/^(Fuente:|Tabla\s*$)/i.test(t)) return true;
  const tokens = t.split(/\s+/);
  if (tokens.length < 5) return false;
  const nums = tokens.filter(tok =>
    /^[\d.,]+%?$/.test(tok) || /^\$[\d.,]+$/.test(tok) || /^\d{4}$/.test(tok)
  );
  const ratio = nums.length / tokens.length;
  if (ratio > 0.28) return true;
  if (/\d\.\d{3}/.test(t) && ratio > 0.18) return true;
  return false;
}

function EnunciadoConPregunta({ texto, tieneImagen }: { texto: string; tieneImagen?: boolean }) {
  const todosParrafos = texto.split('\n\n').filter(Boolean);
  const parrafos = tieneImagen ? todosParrafos.filter(p => !esParrafoTabla(p)) : todosParrafos;
  return (
    <div>
      {parrafos.map((p, i) => {
        const t = p.trim();
        const pregIdx = t.indexOf('¿');
        if (pregIdx >= 0) {
          return (
            <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0', lineHeight: 1.7, fontSize: "1rem" }}>
              {pregIdx > 0 && <span>{t.slice(0, pregIdx)}</span>}
              <strong>{t.slice(pregIdx)}</strong>
            </p>
          );
        }
        return (
          <p key={i} style={{ margin: i === 0 ? 0 : '10px 0 0', lineHeight: 1.7, fontSize: "1rem" }}>
            {t}
          </p>
        );
      })}
    </div>
  );
}

const LET = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const LETRAS_OPCIONES = {
  A: "opcion_a", B: "opcion_b", C: "opcion_c", D: "opcion_d",
  E: "opcion_e", F: "opcion_f", G: "opcion_g", H: "opcion_h",
} as const;

function textoOpcion(p: Pregunta, l: typeof LET[number]): string | null {
  return p[LETRAS_OPCIONES[l]] ?? null;
}

const AREA_ICONOS: Record<string, string> = {
  "Matemáticas": "M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM9 9h6M12 7v10",
  "Lectura Crítica": "M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2zM22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z",
  "Sociales y Ciudadanas": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  "Ciencias Naturales": "M9 3h6M10 3v6L4.5 18.5A1 1 0 0 0 5.4 20h13.2a1 1 0 0 0 .9-1.5L14 9V3M7 14h10",
  "Inglés": "M5 8l4 4-4 4M11 12h8",
};

export default function PreviewCliente({
  examenId,
  titulo,
  sesion,
  preguntas,
}: {
  examenId: number;
  titulo: string;
  sesion: 1 | 2;
  preguntas: Pregunta[];
}) {
  const [filaActual, setFilaActual] = useState<number | null>(null);

  // Resaltar fila actual al hacer scroll
  useEffect(() => {
    const mira = window.innerHeight * 0.35;
    const actualizar = () => {
      let elegido: number | null = null;
      let mejor = Infinity;
      for (const p of preguntas) {
        const el = document.getElementById(`q${p.numero}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mira && r.bottom >= 0) {
          const d = Math.abs(r.top - mira);
          if (d < mejor) { mejor = d; elegido = p.numero; }
        }
      }
      setFilaActual(elegido);
    };
    window.addEventListener("scroll", actualizar, { passive: true });
    actualizar();
    return () => window.removeEventListener("scroll", actualizar);
  }, [preguntas]);

  useEffect(() => {
    if (filaActual === null) return;
    const el = document.getElementById(`fila-${filaActual}`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [filaActual]);

  function irAPregunta(num: number) {
    const el = document.getElementById(`q${num}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const grupos: { area: string; items: Pregunta[] }[] = [];
  for (const p of preguntas) {
    const last = grupos[grupos.length - 1];
    if (!last || last.area !== p.area) {
      grupos.push({ area: p.area, items: [p] });
    } else {
      last.items.push(p);
    }
  }

  return (
    <>
      {/* Banner de preview */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#f59e0b", color: "#78350f",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 18px", fontSize: ".82rem", fontWeight: 700,
        boxShadow: "0 2px 8px rgba(0,0,0,.12)",
      }}>
        <span>👁 VISTA PREVIA — Correctas en verde</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[1, 2].map(s => (
            <Link
              key={s}
              href={`/examenes/admin/preview/${examenId}?sesion=${s}`}
              style={{
                padding: "4px 12px", borderRadius: 8, fontSize: ".8rem", fontWeight: 700,
                background: sesion === s ? "#78350f" : "rgba(120,53,15,.15)",
                color: sesion === s ? "#fef3c7" : "#78350f",
                textDecoration: "none",
              }}
            >
              Sesión {s}
            </Link>
          ))}
          <Link href="/examenes/admin" style={{ color: "#78350f", fontSize: ".8rem", textDecoration: "underline", marginLeft: 4 }}>
            ← Panel
          </Link>
        </div>
      </div>

      {/* Header idéntico al del estudiante */}
      <header style={{
        position: "sticky", top: 33, zIndex: 30, background: "#fff",
        borderBottom: "1px solid var(--linea)", display: "flex", alignItems: "center",
        gap: 16, padding: "12px 22px", boxShadow: "0 2px 14px -8px rgba(0,0,0,.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logo.png" alt="Grupo 500" width={38} height={38} />
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-.01em" }}>
              Grupo <span style={{ color: "var(--azul)" }}>500</span>
            </div>
            <div className="nota">{titulo} · {sesion === 1 ? "Primera" : "Segunda"} sesión</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            background: "var(--azul-claro)", color: "var(--azul-osc)",
            fontWeight: 800, padding: "9px 16px", borderRadius: 999,
          }}>
            <span style={{ fontSize: ".7rem", fontWeight: 600, color: "var(--azul)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Vista previa
            </span>
          </div>
        </div>
      </header>

      {/* Cuerpo — layout idéntico */}
      <div style={{
        maxWidth: 1180, margin: "0 auto", padding: "26px 22px 80px",
        display: "grid", gridTemplateColumns: "1fr 300px", gap: 30, alignItems: "stretch",
      }} className="wrap-exam">

        {/* Cabecera de sesión */}
        <div style={{
          gridColumn: "1/-1",
          background: "linear-gradient(120deg, var(--azul-osc), var(--azul))",
          color: "#fff", borderRadius: "var(--radio)", padding: "22px 26px",
          boxShadow: "var(--sombra)",
        }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>
            {titulo} — {sesion === 1 ? "Primera" : "Segunda"} sesión
          </h1>
          <p style={{ opacity: .85, fontSize: ".92rem", marginTop: 4 }}>
            Marca tu respuesta en la hoja de respuestas de la derecha. Solo se contabilizan las marcas de la hoja.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {grupos.map(({ area, items }) => (
              <span key={area} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)",
                padding: "6px 13px", borderRadius: 999, fontSize: ".8rem", fontWeight: 600,
              }}>
                <svg style={{ width: 15, height: 15, opacity: .9, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} viewBox="0 0 24 24">
                  <path d={AREA_ICONOS[area] ?? "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"} />
                </svg>
                {area} · {items.length}
              </span>
            ))}
          </div>
        </div>

        {/* Preguntas */}
        <main style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {grupos.map(({ area, items }) => (
            <div key={area}>
              <div style={{
                fontSize: ".8rem", fontWeight: 800, color: "var(--azul)",
                textTransform: "uppercase", letterSpacing: ".1em",
                margin: "10px 2px 6px", display: "flex", alignItems: "center", gap: 10,
              }}>
                {area}
                <span style={{ flex: 1, height: 1, background: "var(--azul-borde)", display: "block" }} />
              </div>

              {items.map((p, idx) => {
                const esPrimera = idx === 0 || items[idx - 1].contexto !== p.contexto;
                const esPlaceholder = !p.opcion_a && !p.opcion_b;
                const opcDisponibles = LET.filter((l) => textoOpcion(p, l) !== null);

                return (
                  <div key={p.id}>
                    {p.contexto && esPrimera && (
                      <div style={{
                        background: "var(--azul-claro)", border: "1px solid var(--azul-borde)",
                        borderRadius: "var(--radio)", padding: "16px 20px", marginBottom: 8,
                        fontSize: ".9rem", lineHeight: 1.7,
                      }}>
                        <TextoConParrafos texto={p.contexto} style={{ fontSize: ".9rem" }} />
                      </div>
                    )}

                    <div
                      id={`q${p.numero}`}
                      style={{
                        background: "#fff", border: "1px solid var(--linea)",
                        borderRadius: "var(--radio)", padding: "22px 24px",
                        scrollMarginTop: 110, marginBottom: 14,
                      }}
                    >
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 30, height: 30, background: "var(--azul)", color: "#fff",
                        fontWeight: 800, borderRadius: 9, fontSize: ".92rem", padding: "0 8px",
                      }}>
                        {p.numero}
                      </span>

                      {esPlaceholder ? (
                        <div style={{
                          margin: "14px 0", borderRadius: 12, padding: "20px",
                          background: "#fff8e1", border: "1.5px dashed #f4d784",
                          color: "#7a5b00", fontSize: ".9rem", fontWeight: 600,
                        }}>
                          Esta pregunta requiere ver la figura del cuadernillo original.
                        </div>
                      ) : (
                        <div style={{ margin: "12px 0 4px" }}>
                          {p.imagen_url && (
                            <div style={{ margin: "10px 0 14px" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.imagen_url}
                                alt={`Figura pregunta ${p.numero}`}
                                style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid var(--linea)" }}
                              />
                            </div>
                          )}
                          <EnunciadoConPregunta texto={p.enunciado} tieneImagen={!!p.imagen_url} />
                        </div>
                      )}

                      {!esPlaceholder && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                          {opcDisponibles.map((l) => {
                            const esCor = l === p.correcta.toUpperCase();
                            return (
                              <div key={l} style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                border: `1.5px solid ${esCor ? "var(--ok)" : "var(--linea)"}`,
                                borderRadius: 12, padding: "11px 14px",
                                background: esCor ? "#e7f6ec" : "#fafbff",
                              }}>
                                <span style={{
                                  flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                                  display: "grid", placeItems: "center",
                                  fontWeight: 800, fontSize: ".82rem",
                                  background: esCor ? "var(--ok)" : "var(--azul-borde)",
                                  color: esCor ? "#fff" : "var(--azul)",
                                }}>
                                  {l}
                                </span>
                                <span style={{ paddingTop: 2, fontSize: ".96rem", flex: 1 }}>
                                  {textoOpcion(p, l)}
                                </span>
                                {esCor && (
                                  <span style={{ fontSize: ".75rem", color: "var(--ok)", fontWeight: 700, flexShrink: 0, paddingTop: 4 }}>
                                    ✓ Correcta
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </main>

        {/* Hoja de respuestas — idéntica, muestra correctas marcadas */}
        <aside>
          <div style={{
            position: "sticky", top: 119, background: "#fff",
            border: "1px solid var(--linea)", borderRadius: "var(--radio)",
            boxShadow: "var(--sombra)", overflow: "hidden",
          }}>
            <div style={{ background: "var(--azul-osc)", color: "#fff", padding: "13px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: ".92rem" }}>Hoja de respuestas</div>
              <div style={{ fontSize: ".75rem", opacity: .85, marginTop: 2 }}>
                Verde = respuesta correcta
              </div>
            </div>

            <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto", padding: "8px 6px" }}>
              {preguntas.map((p) => {
                const esActual = p.numero === filaActual;
                const bolaLetras = p.opcion_a ? LET.filter((l) => textoOpcion(p, l) !== null) : LET;

                return (
                  <div
                    key={p.id}
                    id={`fila-${p.numero}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 10px", borderRadius: 9, cursor: "pointer",
                      background: esActual ? "var(--azul-claro)" : "transparent",
                      boxShadow: esActual ? "inset 3px 0 0 var(--azul)" : "none",
                      transition: "background .15s",
                    }}
                    onClick={() => irAPregunta(p.numero)}
                  >
                    <span style={{
                      width: 24, textAlign: "right", fontWeight: 700, fontSize: ".82rem",
                      color: "var(--gris)", fontVariantNumeric: "tabular-nums",
                    }}>
                      {p.numero}
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginLeft: 4, maxWidth: 180 }}>
                      {bolaLetras.map((l) => {
                        const esCor = l === p.correcta.toUpperCase();
                        const sz = bolaLetras.length > 4 ? 22 : 26;
                        return (
                          <div
                            key={l}
                            onClick={(e) => { e.stopPropagation(); irAPregunta(p.numero); }}
                            style={{
                              width: sz, height: sz, borderRadius: "50%",
                              border: `2px solid ${esCor ? "var(--ok)" : "var(--azul-borde)"}`,
                              background: esCor ? "var(--ok)" : "transparent",
                              color: esCor ? "#fff" : "var(--azul)",
                              display: "grid", placeItems: "center",
                              fontSize: bolaLetras.length > 4 ? ".65rem" : ".72rem",
                              fontWeight: 800, cursor: "pointer",
                              transition: "all .12s",
                            }}
                          >
                            {l}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 12, borderTop: "1px solid var(--linea)" }}>
              <Link
                href="/examenes/admin"
                className="btn btn-claro btn-bloque"
                style={{ fontSize: ".88rem", padding: "10px 14px", textAlign: "center", display: "block" }}
              >
                ← Volver al panel
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
