'use server'

import { auth, hashDocumento } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const MAX_CORAZONES_FREE = 5
const HORAS_POR_CORAZON = 4
const XP_POR_CORRECTA = 10
const XP_BONO_PERFECTO = 20

async function estudianteActual(): Promise<string | null> {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ESTUDIANTE') return null
  return session!.user.id
}

// ── Registro público ─────────────────────────────────────────────────────
export async function registrarEstudiante(data: { nombre: string; email: string; documento: string }) {
  const nombre = data.nombre.trim()
  const email = data.email.trim().toLowerCase()
  const documento = data.documento.trim()

  if (!nombre || !email || !documento) return { error: 'Completa todos los campos' }

  const existente = await prisma.estudianteExamen.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  if (existente) return { error: 'Ya existe una cuenta con ese correo. Inicia sesión.' }

  const estudiante = await prisma.estudianteExamen.create({
    data: { nombre, email, documentoHash: hashDocumento(documento) },
  })
  await prisma.britoPerfil.create({ data: { estudianteId: estudiante.id } })

  return { ok: true }
}

// ── Perfil (con regeneración perezosa de corazones) ─────────────────────
async function calcularCorazones(perfil: { corazones: number; corazonesAt: Date; plan: string }) {
  if (perfil.plan === 'PREMIUM' || perfil.corazones >= MAX_CORAZONES_FREE) {
    return { corazones: perfil.corazones, corazonesAt: perfil.corazonesAt }
  }
  const horas = (Date.now() - perfil.corazonesAt.getTime()) / (1000 * 60 * 60)
  const ganados = Math.floor(horas / HORAS_POR_CORAZON)
  if (ganados <= 0) return { corazones: perfil.corazones, corazonesAt: perfil.corazonesAt }

  const nuevos = Math.min(MAX_CORAZONES_FREE, perfil.corazones + ganados)
  const nuevaFecha = new Date(perfil.corazonesAt.getTime() + ganados * HORAS_POR_CORAZON * 60 * 60 * 1000)
  return { corazones: nuevos, corazonesAt: nuevaFecha }
}

export async function obtenerPerfilActual() {
  const estudianteId = await estudianteActual()
  if (!estudianteId) return null

  let perfil = await prisma.britoPerfil.findUnique({ where: { estudianteId } })
  if (!perfil) perfil = await prisma.britoPerfil.create({ data: { estudianteId } })

  const { corazones, corazonesAt } = await calcularCorazones(perfil)
  if (corazones !== perfil.corazones || corazonesAt.getTime() !== perfil.corazonesAt.getTime()) {
    perfil = await prisma.britoPerfil.update({ where: { estudianteId }, data: { corazones, corazonesAt } })
  }
  return perfil
}

// ── Responder una pregunta (valida server-side, resta corazón si falla) ──
export async function responderPregunta(preguntaId: string, opcionElegida: string) {
  const estudianteId = await estudianteActual()
  if (!estudianteId) return { error: 'No autorizado' }

  const perfil = await obtenerPerfilActual()
  if (!perfil) return { error: 'Sin perfil' }
  if (perfil.plan !== 'PREMIUM' && perfil.corazones <= 0) return { error: 'sin_corazones' }

  const pregunta = await prisma.preguntaExamen.findUnique({
    where: { id: BigInt(preguntaId) },
    select: { correcta: true, explicacion: true },
  })
  if (!pregunta) return { error: 'Pregunta no encontrada' }

  const esCorrecta = pregunta.correcta.trim().toUpperCase() === opcionElegida.trim().toUpperCase()

  if (!esCorrecta && perfil.plan !== 'PREMIUM') {
    await prisma.britoPerfil.update({
      where: { estudianteId },
      data: { corazones: { decrement: 1 }, corazonesAt: perfil.corazones === MAX_CORAZONES_FREE ? new Date() : perfil.corazonesAt },
    })
  }

  return {
    ok: true,
    correcta: esCorrecta,
    letraCorrecta: pregunta.correcta.trim().toUpperCase(),
    explicacion: pregunta.explicacion,
  }
}

// ── Finalizar lección: XP, racha, registro de completada ────────────────
export async function finalizarLeccion(leccionId: string, correctas: number, total: number) {
  const estudianteId = await estudianteActual()
  if (!estudianteId) return { error: 'No autorizado' }

  const perfil = await prisma.britoPerfil.findUnique({ where: { estudianteId } })
  if (!perfil) return { error: 'Sin perfil' }

  let xpGanado = correctas * XP_POR_CORRECTA
  if (total > 0 && correctas === total) xpGanado += XP_BONO_PERFECTO

  const hoy = new Date()
  const esMismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const esDiaSiguiente = (anterior: Date, actual: Date) => {
    const dif = Math.floor((actual.setHours(0, 0, 0, 0) - new Date(anterior).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
    return dif === 1
  }

  let rachaActual = perfil.rachaActual
  if (!perfil.ultimaLeccionAt) {
    rachaActual = 1
  } else if (esMismoDia(perfil.ultimaLeccionAt, hoy)) {
    rachaActual = perfil.rachaActual
  } else if (esDiaSiguiente(perfil.ultimaLeccionAt, new Date())) {
    rachaActual = perfil.rachaActual + 1
  } else {
    rachaActual = 1
  }
  const rachaMejor = Math.max(perfil.rachaMejor, rachaActual)

  await prisma.$transaction([
    prisma.britoLeccionCompletada.create({
      data: { estudianteId, leccionId, correctas, total, xpGanado },
    }),
    prisma.britoPerfil.update({
      where: { estudianteId },
      data: { xpTotal: { increment: xpGanado }, rachaActual, rachaMejor, ultimaLeccionAt: new Date() },
    }),
  ])

  revalidatePath('/brito/mapa')
  revalidatePath('/brito/ranking')
  return { ok: true, xpGanado, rachaActual }
}

// ── Ranking semanal simple (global, por XP ganado en los últimos 7 días) ─
export async function obtenerRanking() {
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const filas = await prisma.britoLeccionCompletada.groupBy({
    by: ['estudianteId'],
    where: { completadaAt: { gte: hace7dias } },
    _sum: { xpGanado: true },
    orderBy: { _sum: { xpGanado: 'desc' } },
    take: 20,
  })

  const estudiantes = await prisma.estudianteExamen.findMany({
    where: { id: { in: filas.map(f => f.estudianteId) } },
    select: { id: true, nombre: true },
  })
  const nombreDe = new Map(estudiantes.map(e => [e.id, e.nombre]))

  return filas.map((f, i) => ({
    posicion: i + 1,
    estudianteId: f.estudianteId,
    nombre: nombreDe.get(f.estudianteId) ?? 'Estudiante',
    xpSemana: f._sum.xpGanado ?? 0,
  }))
}
