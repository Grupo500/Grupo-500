// Importa el dump de Supabase (sim_*) al Postgres de Railway vía Prisma.
// Idempotente: usa upsert y preserva los IDs originales.
// Orden de inserción respeta las FKs: examen → estudiante → pregunta → intento.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const DUMP = "C:/Users/prueb/AppData/Local/Temp/claude/C--Users-prueb-Documents-GitHub-Claude-Proyectos/c7504d98-1c78-47c2-b8f3-209db34a5f05/scratchpad/supabase-dump.json";
const data = JSON.parse(readFileSync(DUMP, "utf8"));
const prisma = new PrismaClient();

const fecha = (v) => (v ? new Date(v) : null);

try {
  // 1. Examenes (sim_simulacros)
  for (const s of data.sim_simulacros) {
    const row = {
      id: s.id,
      titulo: s.titulo,
      descripcion: s.descripcion ?? null,
      abreAt: fecha(s.abre_at),
      cierraAt: fecha(s.cierra_at),
      duracionMin: s.duracion_min ?? null,
      activo: s.activo ?? false,
    };
    await prisma.examen.upsert({ where: { id: s.id }, create: row, update: row });
  }
  console.log(`Examen: ${data.sim_simulacros.length} ✓`);

  // 2. Estudiantes de examen (sim_estudiantes)
  for (const e of data.sim_estudiantes) {
    const row = {
      id: e.id,
      email: e.email,
      documentoHash: e.documento_hash,
      nombre: e.nombre,
      colegioId: e.colegio_id ?? null,
      creadoAt: fecha(e.creado_at) ?? new Date(),
    };
    await prisma.estudianteExamen.upsert({ where: { id: e.id }, create: row, update: row });
  }
  console.log(`EstudianteExamen: ${data.sim_estudiantes.length} ✓`);

  // 3. Preguntas (sim_preguntas) — preservar id (BigInt) para que respuestas casen
  for (const p of data.sim_preguntas) {
    const row = {
      id: BigInt(p.id),
      examenId: p.simulacro_id,
      sesion: p.sesion,
      area: p.area ?? null,
      numero: p.numero ?? null,
      contexto: p.contexto ?? null,
      enunciado: p.enunciado,
      opcionA: p.opcion_a ?? null,
      opcionB: p.opcion_b ?? null,
      opcionC: p.opcion_c ?? null,
      opcionD: p.opcion_d ?? null,
      correcta: p.correcta,
      explicacion: p.explicacion ?? null,
      imagenUrl: p.imagen_url ?? null,
      tieneImagen: p.tiene_imagen ?? false,
    };
    await prisma.preguntaExamen.upsert({ where: { id: BigInt(p.id) }, create: row, update: row });
  }
  console.log(`PreguntaExamen: ${data.sim_preguntas.length} ✓`);

  // 4. Intentos (sim_intentos)
  for (const i of data.sim_intentos) {
    const row = {
      id: BigInt(i.id),
      estudianteId: i.estudiante_id,
      examenId: i.simulacro_id,
      respuestas: i.respuestas ?? {},
      correctas: i.correctas ?? null,
      total: i.total ?? null,
      puntaje: i.puntaje ?? null,
      sesionActual: i.sesion_actual ?? 1,
      iniciadoAt: fecha(i.iniciado_at) ?? new Date(),
      finalizadoAt: fecha(i.finalizado_at),
    };
    await prisma.intentoExamen.upsert({ where: { id: BigInt(i.id) }, create: row, update: row });
  }
  console.log(`IntentoExamen: ${data.sim_intentos.length} ✓`);

  // Verificación: conteos finales en Railway
  const [ex, es, pr, it] = await Promise.all([
    prisma.examen.count(),
    prisma.estudianteExamen.count(),
    prisma.preguntaExamen.count(),
    prisma.intentoExamen.count(),
  ]);
  console.log(`\n=== Conteos en Railway ===\nExamen: ${ex} | EstudianteExamen: ${es} | PreguntaExamen: ${pr} | IntentoExamen: ${it}`);
} finally {
  await prisma.$disconnect();
}
