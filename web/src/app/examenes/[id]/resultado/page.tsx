import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

type ResultadoArea = {
  area: string;
  correctas: number;
  total: number;
  puntaje: number;
};

const PESOS: Record<string, number> = {
  "Lectura Crítica": 3, Matemáticas: 3,
  "Sociales y Ciudadanas": 3, "Ciencias Naturales": 3, Inglés: 1,
};

const COLOR_AREA: Record<string, string> = {
  Matemáticas: "#6366f1",
  "Lectura Crítica": "#0ea5e9",
  "Sociales y Ciudadanas": "#10b981",
  "Ciencias Naturales": "#f59e0b",
  Inglés: "#ec4899",
};

// Misma lógica que simulacros-grupo500/src/app/simulacro/[id]/resultado/page.tsx,
// portada a Prisma/NextAuth en vez de Supabase/cookie propia.
export default async function PaginaResultado({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if ((session?.user as any)?.role !== 'ESTUDIANTE') redirect('/sign-in');
  const estudId = session!.user.id;

  const simId = parseInt(id);
  if (isNaN(simId)) redirect("/examenes");

  const [intento, preguntas, sim] = await Promise.all([
    prisma.intentoExamen.findUnique({
      where: { estudianteId_examenId: { estudianteId: estudId, examenId: simId } },
    }),
    prisma.preguntaExamen.findMany({
      where: { examenId: simId },
      orderBy: [{ sesion: 'asc' }, { numero: 'asc' }],
      select: {
        id: true, sesion: true, numero: true, area: true, contexto: true, enunciado: true,
        opcionA: true, opcionB: true, opcionC: true, opcionD: true, correcta: true, explicacion: true,
      },
    }),
    prisma.examen.findUnique({ where: { id: simId }, select: { titulo: true } }),
  ]);

  if (!intento?.finalizadoAt) redirect(`/examenes/${simId}`);

  const respPlanas: Record<string, string> = {
    ...(((intento.respuestas as Record<string, Record<string, string>>) ?? {}).s1 ?? {}),
    ...(((intento.respuestas as Record<string, Record<string, string>>) ?? {}).s2 ?? {}),
  };

  const qs = preguntas.map(p => ({
    id: Number(p.id),
    sesion: p.sesion,
    numero: p.numero ?? 0,
    area: p.area ?? '',
    enunciado: p.enunciado,
    opcion_a: p.opcionA,
    opcion_b: p.opcionB,
    opcion_c: p.opcionC,
    opcion_d: p.opcionD,
    correcta: p.correcta,
    explicacion: p.explicacion,
  }));

  // Calcular por área
  const acc: Record<string, { c: number; t: number }> = {};
  for (const p of qs) {
    if (!p.correcta) continue;
    const a = (acc[p.area] ??= { c: 0, t: 0 });
    a.t += 1;
    if (respPlanas[String(p.id)] === p.correcta) a.c += 1;
  }
  const porArea: ResultadoArea[] = Object.entries(acc).map(([area, v]) => ({
    area, correctas: v.c, total: v.t,
    puntaje: v.t > 0 ? Math.round((v.c / v.t) * 100) : 0,
  }));

  const global = intento.puntaje ? Number(intento.puntaje) : 0;
  const totalCorrectas = intento.correctas ?? 0;
  const totalPreguntas = qs.filter((p) => p.correcta).length;

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 30, background: "#fff",
        borderBottom: "1px solid var(--linea)", display: "flex", alignItems: "center",
        gap: 16, padding: "12px 22px", boxShadow: "0 2px 14px -8px rgba(0,0,0,.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logo.png" alt="Grupo 500" width={38} height={38} />
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem" }}>
              Grupo <span style={{ color: "var(--azul)" }}>500</span>
            </div>
            <div className="nota">{sim?.titulo ?? "Simulacro"} — Retroalimentación</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/inicio" className="btn btn-claro" style={{ padding: "8px 14px", fontSize: ".85rem" }}>
            Inicio
          </Link>
          <form action={async () => { await signOut({ redirectTo: '/sign-in' }) }}>
            <button className="btn" type="submit" style={{ padding: "8px 14px", fontSize: ".85rem", color: "var(--gris)", border: "1px solid var(--linea)", borderRadius: 10 }}>
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="contenedor" style={{ padding: "28px 22px 80px", maxWidth: 900 }}>
        {/* Puntaje global */}
        <div style={{
          background: "linear-gradient(120deg, var(--azul-osc), var(--azul))",
          color: "#fff", borderRadius: "var(--radio)", padding: "28px 30px",
          boxShadow: "var(--sombra)", textAlign: "center", marginBottom: 28,
        }}>
          <div className="nota" style={{ color: "rgba(255,255,255,.8)", fontSize: ".85rem", marginBottom: 8 }}>
            Puntaje global estimado
          </div>
          <div style={{ fontSize: "4rem", fontWeight: 800, lineHeight: 1, fontFamily: "Poppins, sans-serif" }}>
            {global}
          </div>
          <div style={{ fontSize: "1.1rem", opacity: .7, marginTop: 4 }}>de 500 puntos</div>
          <div style={{ marginTop: 12, fontSize: ".88rem", opacity: .85 }}>
            {totalCorrectas} correctas de {totalPreguntas} preguntas
          </div>
          <div style={{
            height: 10, background: "rgba(255,255,255,.25)", borderRadius: 999,
            margin: "16px auto 0", maxWidth: 360,
          }}>
            <div style={{
              height: "100%", width: `${(global / 500) * 100}%`,
              background: "#fff", borderRadius: 999,
            }} />
          </div>
        </div>

        {/* Por área */}
        <h2 className="display" style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>Resultados por área</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 36 }}>
          {porArea.map((a) => (
            <div key={a.area} className="tarjeta" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR_AREA[a.area] ?? "var(--azul)", flexShrink: 0 }} />
                <span style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--gris)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {a.area}
                </span>
              </div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: COLOR_AREA[a.area] ?? "var(--azul)", lineHeight: 1 }}>
                {a.puntaje}
              </div>
              <div className="nota" style={{ marginTop: 4 }}>
                {a.correctas} / {a.total} — peso ×{PESOS[a.area] ?? 1}
              </div>
              <div style={{ height: 6, background: "var(--linea)", borderRadius: 999, marginTop: 10 }}>
                <div style={{
                  height: "100%", width: `${a.puntaje}%`,
                  background: COLOR_AREA[a.area] ?? "var(--azul)", borderRadius: 999,
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Detalle pregunta por pregunta */}
        {[1, 2].map((ses) => {
          const qsSes = qs.filter((p) => p.sesion === ses);
          if (!qsSes.length) return null;
          return (
            <div key={ses} style={{ marginBottom: 36 }}>
              <h2 className="display" style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>
                {ses === 1 ? "Primera" : "Segunda"} sesión — Detalle
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {qsSes.map((p) => {
                  const dada = respPlanas[String(p.id)];
                  const esCorrecta = dada === p.correcta;
                  const noRespondida = !dada;

                  let borderColor = "var(--linea)";
                  if (!p.correcta) borderColor = "var(--linea)";
                  else if (esCorrecta) borderColor = "var(--ok)";
                  else if (noRespondida) borderColor = "var(--gris)";
                  else borderColor = "var(--mal)";

                  return (
                    <div key={p.id} style={{
                      background: "#fff", border: `1.5px solid ${borderColor}`,
                      borderRadius: "var(--radio)", padding: "18px 20px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          minWidth: 28, height: 28, fontWeight: 800, borderRadius: 8, fontSize: ".88rem",
                          background: !p.correcta ? "var(--linea)" : esCorrecta ? "var(--ok)" : noRespondida ? "var(--gris)" : "var(--mal)",
                          color: "#fff", padding: "0 6px",
                        }}>
                          {p.numero}
                        </span>
                        <span style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--gris)", textTransform: "uppercase" }}>
                          {p.area}
                        </span>
                        <span style={{
                          marginLeft: "auto", fontSize: ".78rem", fontWeight: 700, padding: "3px 10px",
                          borderRadius: 999,
                          background: !p.correcta ? "var(--linea)" : esCorrecta ? "#e7f6ec" : noRespondida ? "var(--linea)" : "#fef2f2",
                          color: !p.correcta ? "var(--gris)" : esCorrecta ? "var(--ok)" : noRespondida ? "var(--gris)" : "var(--mal)",
                        }}>
                          {!p.correcta ? "—" : esCorrecta ? "Correcta ✓" : noRespondida ? "Sin responder" : "Incorrecta ✗"}
                        </span>
                      </div>

                      {/* Enunciado */}
                      <div style={{ marginBottom: 10 }}>
                        {p.enunciado.split('\n\n').filter(Boolean).map((par, i) => (
                          <p key={i} style={{ fontSize: ".95rem", lineHeight: 1.6, margin: i === 0 ? 0 : "8px 0 0" }}>
                            {par.trim()}
                          </p>
                        ))}
                      </div>

                      {/* Opciones */}
                      {p.opcion_a && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {([
                            ["A", p.opcion_a], ["B", p.opcion_b], ["C", p.opcion_c], ["D", p.opcion_d],
                          ] as const).map(([l, txt]) => {
                            if (!txt) return null;
                            const esCor = l === p.correcta;
                            const esDada = l === dada;
                            return (
                              <div key={l} style={{
                                display: "flex", alignItems: "flex-start", gap: 10,
                                padding: "8px 12px", borderRadius: 10,
                                background: esCor ? "#e7f6ec" : esDada && !esCor ? "#fef2f2" : "#fafbff",
                                border: `1px solid ${esCor ? "var(--ok)" : esDada && !esCor ? "var(--mal)" : "var(--linea)"}`,
                              }}>
                                <span style={{
                                  flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                                  display: "grid", placeItems: "center",
                                  fontWeight: 800, fontSize: ".78rem",
                                  background: esCor ? "var(--ok)" : esDada && !esCor ? "var(--mal)" : "var(--azul-borde)",
                                  color: esCor || (esDada && !esCor) ? "#fff" : "var(--azul)",
                                }}>
                                  {l}
                                </span>
                                <span style={{ fontSize: ".92rem", paddingTop: 2 }}>{txt}</span>
                                {esCor && <span style={{ marginLeft: "auto", fontSize: ".75rem", color: "var(--ok)", fontWeight: 700, flexShrink: 0 }}>✓ Correcta</span>}
                                {esDada && !esCor && <span style={{ marginLeft: "auto", fontSize: ".75rem", color: "var(--mal)", fontWeight: 700, flexShrink: 0 }}>Tu respuesta</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explicación */}
                      {p.explicacion && (
                        <div style={{
                          background: "var(--azul-claro)", borderRadius: 10,
                          padding: "10px 14px", fontSize: ".85rem", color: "var(--azul-osc)",
                          borderLeft: "3px solid var(--azul)",
                        }}>
                          <strong>Explicación: </strong>{p.explicacion}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
