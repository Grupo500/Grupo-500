"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { guardarRespuestas, finalizarSesion1, finalizarSimulacro } from "./acciones";

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
  imagen_url: string | null;
};

// Renderiza contexto (texto corrido, sin negrilla)
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

// Detecta si un párrafo es texto de tabla extraído del PDF (filas de números/columnas)
function esParrafoTabla(p: string): boolean {
  const t = p.trim();
  // Líneas de fuente/crédito
  if (/^(Fuente:|Tabla\s*$)/i.test(t)) return true;
  const tokens = t.split(/\s+/);
  if (tokens.length < 5) return false;
  const nums = tokens.filter(tok =>
    /^[\d.,]+%?$/.test(tok) ||
    /^\$[\d.,]+$/.test(tok) ||
    /^\d{4}$/.test(tok)
  );
  const ratio = nums.length / tokens.length;
  // Ratio alto → tabla
  if (ratio > 0.28) return true;
  // Precios colombianos (1.400.000) + ratio moderado → lista de precios/tabla
  if (/\d\.\d{3}/.test(t) && ratio > 0.18) return true;
  return false;
}

// Renderiza el enunciado de la pregunta:
// - Si tiene imagen: oculta párrafos de tabla (ya se ven en la imagen)
// - La parte ¿...? siempre va en negrilla
function EnunciadoConPregunta({ texto, tieneImagen }: { texto: string; tieneImagen?: boolean }) {
  const todosParrafos = texto.split('\n\n').filter(Boolean);
  // Si hay imagen subida, filtramos los párrafos que son dump de tabla
  const parrafos = tieneImagen
    ? todosParrafos.filter(p => !esParrafoTabla(p))
    : todosParrafos;

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

const LET = ["A", "B", "C", "D"] as const;
const LETRAS_OPCIONES = {
  A: "opcion_a", B: "opcion_b", C: "opcion_c", D: "opcion_d",
} as const;

function textoOpcion(p: Pregunta, l: typeof LET[number]): string | null {
  return p[LETRAS_OPCIONES[l]] ?? null;
}

function formatearTiempo(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const AREA_ICONOS: Record<string, string> = {
  "Matemáticas": "M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM9 9h6M12 7v10",
  "Lectura Crítica": "M2 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2zM22 4h-7a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z",
  "Sociales y Ciudadanas": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  "Ciencias Naturales": "M9 3h6M10 3v6L4.5 18.5A1 1 0 0 0 5.4 20h13.2a1 1 0 0 0 .9-1.5L14 9V3M7 14h10",
  "Inglés": "M5 8l4 4-4 4M11 12h8",
};

export default function ExamenCliente({
  simulacroId,
  titulo,
  sesion,
  preguntas,
  respuestasPrevias,
  iniciadoAt,
  duracionMin,
}: {
  simulacroId: number;
  titulo: string;
  sesion: 1 | 2;
  preguntas: Pregunta[];
  respuestasPrevias: Record<string, string>;
  iniciadoAt: string;
  duracionMin: number | null;
}) {
  const router = useRouter();
  const [esCelular, setEsCelular] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string>>(respuestasPrevias);
  const [segundos, setSegundos] = useState(0);
  const [filaActual, setFilaActual] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [yendoAHome, setYendoAHome] = useState(false);
  const [isPending, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const respuestasRef = useRef(respuestas);

  // Detectar móvil (≤600px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    setEsCelular(mq.matches);
    const handler = (e: MediaQueryListEvent) => setEsCelular(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Mantener ref actualizada para usarla en eventos sin stale closure
  useEffect(() => { respuestasRef.current = respuestas; }, [respuestas]);

  // Guardar inmediatamente al minimizar/cambiar pestaña o cerrar
  useEffect(() => {
    const guardarAhora = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      startTransition(() => guardarRespuestas(simulacroId, sesion, respuestasRef.current));
    };
    const onHide = () => { if (document.visibilityState === "hidden") guardarAhora(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", guardarAhora);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", guardarAhora);
    };
  }, [simulacroId, sesion]);

  // Ir a home guardando primero
  async function irAHome() {
    setYendoAHome(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await guardarRespuestas(simulacroId, sesion, respuestasRef.current);
    router.push("/inicio");
  }

  // Timer
  useEffect(() => {
    const inicio = new Date(iniciadoAt).getTime();
    const base = duracionMin ? duracionMin * 60 : 0;

    const actualizar = () => {
      const transcurrido = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(base > 0 ? Math.max(0, base - transcurrido) : transcurrido);
    };
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [iniciadoAt, duracionMin]);

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

  // Scroll a fila en la hoja cuando cambia la pregunta actual
  useEffect(() => {
    if (filaActual === null) return;
    const el = document.getElementById(`fila-${filaActual}`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [filaActual]);

  function marcar(pregId: number, letra: string) {
    const nuevas = { ...respuestas, [String(pregId)]: letra };
    setRespuestas(nuevas);

    // Guardar en servidor con debounce de 2 s
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      startTransition(() => guardarRespuestas(simulacroId, sesion, nuevas));
    }, 2000);
  }

  function irAPregunta(num: number) {
    const el = document.getElementById(`q${num}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function contestadas() {
    return preguntas.filter((p) => respuestas[String(p.id)]).length;
  }

  async function handleFinalizar() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    startTransition(async () => {
      if (sesion === 1) {
        await finalizarSesion1(simulacroId, respuestas);
      } else {
        await finalizarSimulacro(simulacroId, respuestas);
      }
    });
  }

  // Agrupar por área, mostrando contexto solo cuando cambia
  const grupos: { area: string; items: Pregunta[] }[] = [];
  for (const p of preguntas) {
    const last = grupos[grupos.length - 1];
    if (!last || last.area !== p.area) {
      grupos.push({ area: p.area, items: [p] });
    } else {
      last.items.push(p);
    }
  }

  const totalPreguntas = preguntas.length;
  const cant = contestadas();
  const porcentaje = totalPreguntas > 0 ? (cant / totalPreguntas) * 100 : 0;
  const enCountdown = duracionMin !== null;
  const tiempoColor = enCountdown && segundos < 600 ? "var(--mal)" : "var(--azul-osc)";

  return (
    <>
      {/* Header fijo */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30, background: "#fff",
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
          {/* Botón Home */}
          <button
            onClick={irAHome}
            disabled={yendoAHome}
            title="Volver al inicio (tus respuestas se guardan)"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 999,
              border: "1.5px solid var(--linea)", background: "#fff",
              color: "var(--azul-osc)", cursor: "pointer", fontWeight: 600, fontSize: ".85rem",
              opacity: yendoAHome ? .6 : 1, transition: "opacity .2s",
            }}
          >
            {yendoAHome ? (
              <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--azul)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9,22 9,12 15,12 15,22" />
              </svg>
            )}
            <span style={{ display: "none" }} className="home-label">Inicio</span>
          </button>

          {/* Reloj */}
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            background: "var(--azul-claro)", color: tiempoColor,
            fontWeight: 800, padding: "9px 16px", borderRadius: 999,
            fontVariantNumeric: "tabular-nums",
          }}>
            <span style={{ fontSize: ".7rem", fontWeight: 600, color: "var(--azul)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              {enCountdown ? "Tiempo" : "Transcurrido"}
            </span>
            {" "}
            <span>{formatearTiempo(segundos)}</span>
          </div>
        </div>
      </header>

      {/* Cuerpo */}
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
              {/* Separador de área */}
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
                const resp = respuestas[String(p.id)];
                const esPlaceholder = !p.opcion_a && !p.opcion_b;
                const opcDisponibles = LET.filter((l) => textoOpcion(p, l) !== null);

                return (
                  <div key={p.id}>
                    {/* Contexto compartido: solo en el primer cambio */}
                    {p.contexto && esPrimera && (
                      <div style={{
                        background: "var(--azul-claro)", border: "1px solid var(--azul-borde)",
                        borderRadius: "var(--radio)", padding: "16px 20px", marginBottom: 8,
                        fontSize: ".9rem", lineHeight: 1.7,
                      }}>
                        <TextoConParrafos texto={p.contexto} style={{ fontSize: ".9rem" }} />
                      </div>
                    )}

                    {/* Tarjeta de pregunta */}
                    <div
                      id={`q${p.numero}`}
                      className="pregunta-movil"
                      style={{
                        background: "#fff", border: `1px solid ${resp ? "var(--azul-borde)" : "var(--linea)"}`,
                        borderRadius: "var(--radio)", padding: "22px 24px",
                        scrollMarginTop: 90, marginBottom: 14,
                        boxShadow: resp ? "0 0 0 3px var(--azul-claro)" : "none",
                        transition: "border-color .2s, box-shadow .2s",
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
                          <svg style={{ width: 16, height: 16, marginRight: 8, verticalAlign: -2, stroke: "currentColor", fill: "none", strokeWidth: 2 }} viewBox="0 0 24 24">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          Esta pregunta requiere ver la figura del cuadernillo original.
                          <div style={{ fontWeight: 400, marginTop: 6, fontSize: ".82rem", color: "#8a6800" }}>
                            Marca tu respuesta en la hoja de respuestas después de revisar el cuadernillo.
                          </div>
                        </div>
                      ) : (
                        <div style={{ margin: "12px 0 4px" }}>
                          {/* Imagen de la pregunta si está disponible */}
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

                      {/* Opciones */}
                      {!esPlaceholder && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                          {opcDisponibles.map((l) => {
                            const seleccionada = resp === l;
                            if (esCelular) {
                              // Móvil: opción clicable directamente
                              return (
                                <button
                                  key={l}
                                  type="button"
                                  onClick={() => marcar(p.id, l)}
                                  className={`opcion-movil${seleccionada ? " seleccionada" : ""}`}
                                >
                                  <span className="bola">{l}</span>
                                  <span style={{ paddingTop: 2, fontSize: ".96rem", textAlign: "left" }}>
                                    {textoOpcion(p, l)}
                                  </span>
                                </button>
                              );
                            }
                            // Desktop: solo visual, se marca en hoja
                            return (
                              <div key={l} style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                border: "1px solid var(--linea)", borderRadius: 12,
                                padding: "11px 14px", background: "#fafbff",
                              }}>
                                <span style={{
                                  flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                                  border: "2px solid var(--azul-borde)", display: "grid",
                                  placeItems: "center", fontWeight: 800, color: "var(--azul)",
                                  fontSize: ".82rem",
                                }}>
                                  {l}
                                </span>
                                <span style={{ paddingTop: 2, fontSize: ".96rem" }}>
                                  {textoOpcion(p, l)}
                                </span>
                              </div>
                            );
                          })}
                          {!esCelular && (
                            <p style={{ fontSize: ".78rem", color: "var(--gris)", marginTop: 6, fontStyle: "italic" }}>
                              <svg style={{ width: 13, height: 13, marginRight: 4, verticalAlign: -1, stroke: "currentColor", fill: "none", strokeWidth: 2 }} viewBox="0 0 24 24">
                                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                              </svg>
                              Marca tu respuesta en la hoja de respuestas (fila {p.numero}).
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Botón final de la sesión */}
          <div style={{
            background: "#fff", border: "1px solid var(--linea)",
            borderRadius: "var(--radio)", padding: 22, textAlign: "center",
            boxShadow: "var(--sombra)", marginTop: 8,
          }}>
            {!confirmando ? (
              <>
                <p style={{ color: "var(--gris)", fontSize: ".92rem", marginBottom: 14 }}>
                  {sesion === 1
                    ? "Cuando termines la primera sesión, continúa con la segunda."
                    : "Cuando termines la segunda sesión, envía tus respuestas para ver tu puntaje."}
                </p>
                <button
                  className="btn btn-azul"
                  style={{ maxWidth: 420, margin: "0 auto" }}
                  onClick={() => setConfirmando(true)}
                  disabled={isPending}
                >
                  {sesion === 1
                    ? "Finalizar primera sesión → ir a la segunda"
                    : "Enviar respuestas y ver mi puntaje"}
                  <svg style={{ width: 18, height: 18, stroke: "currentColor", fill: "none", strokeWidth: 2 }} viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            ) : (
              <div>
                <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>
                  ¿Seguro que quieres finalizar?
                </p>
                <p style={{ color: "var(--gris)", fontSize: ".88rem", marginBottom: 16 }}>
                  Respondiste <strong>{cant}</strong> de <strong>{totalPreguntas}</strong> preguntas.
                  {cant < totalPreguntas && " Las que no marcaste quedan en blanco."}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    className="btn btn-claro"
                    style={{ minWidth: 120 }}
                    onClick={() => setConfirmando(false)}
                    disabled={isPending}
                  >
                    Volver
                  </button>
                  <button
                    className="btn btn-azul"
                    style={{ minWidth: 180 }}
                    onClick={handleFinalizar}
                    disabled={isPending}
                  >
                    {isPending ? "Guardando…" : "Sí, finalizar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Barra de progreso flotante — solo móvil (CSS oculta aside en ≤600px) */}
        {esCelular && (
          <div className="barra-progreso-movil">
            <div className="pista">
              <div className="relleno" style={{ width: `${porcentaje}%` }} />
            </div>
            <div className="info">
              <span>{cant} de {totalPreguntas} respondidas</span>
              <button
                className="btn btn-azul"
                style={{ padding: "6px 14px", fontSize: ".8rem", borderRadius: 10 }}
                onClick={() => setConfirmando(true)}
                disabled={isPending}
              >
                {sesion === 1 ? "Finalizar sesión 1" : "Enviar y calificar"}
              </button>
            </div>
          </div>
        )}

        {/* Hoja de respuestas (fija a la derecha) */}
        <aside>
          <div style={{
            position: "sticky", top: 86, background: "#fff",
            border: "1px solid var(--linea)", borderRadius: "var(--radio)",
            boxShadow: "var(--sombra)", overflow: "hidden",
          }}>
            <div style={{ background: "var(--azul-osc)", color: "#fff", padding: "13px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: ".92rem" }}>Hoja de respuestas</div>
              <div style={{ fontSize: ".75rem", opacity: .85, marginTop: 2 }}>
                {cant} de {totalPreguntas} contestadas
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,.25)", borderRadius: 999, marginTop: 8 }}>
                <div style={{
                  height: "100%", width: `${porcentaje}%`,
                  background: "#fff", borderRadius: 999, transition: "width .3s",
                }} />
              </div>
            </div>

            <div style={{ maxHeight: "calc(100vh - 230px)", overflowY: "auto", padding: "8px 6px" }}>
              {preguntas.map((p) => {
                const resp = respuestas[String(p.id)];
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
                    <div style={{ display: "flex", gap: 5, marginLeft: 4 }}>
                      {bolaLetras.map((l) => (
                        <div
                          key={l}
                          onClick={(e) => { e.stopPropagation(); marcar(p.id, l); }}
                          style={{
                            width: 26, height: 26, borderRadius: "50%",
                            border: `2px solid ${resp === l ? "var(--azul)" : "var(--azul-borde)"}`,
                            background: resp === l ? "var(--azul)" : "transparent",
                            color: resp === l ? "#fff" : "var(--azul)",
                            display: "grid", placeItems: "center",
                            fontSize: ".72rem", fontWeight: 800, cursor: "pointer",
                            transition: "all .12s",
                          }}
                        >
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 12, borderTop: "1px solid var(--linea)" }}>
              <button
                className="btn btn-azul btn-bloque"
                onClick={() => setConfirmando(true)}
                disabled={isPending}
                style={{ fontSize: ".88rem", padding: "10px 14px" }}
              >
                {sesion === 1 ? "Finalizar sesión 1" : "Enviar y calificar"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
