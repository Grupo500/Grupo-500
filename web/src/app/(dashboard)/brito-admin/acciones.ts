'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { BRITO_BANCO_EXAMEN_ID } from '@/lib/britoBanco'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('No autorizado')
}

export async function crearLeccion(data: { materia: string; titulo: string; orden: number; sesion: number }) {
  await requireAdmin()
  const leccion = await prisma.britoLeccion.create({ data })
  revalidatePath('/brito-admin')
  return { ok: true, id: leccion.id }
}

export async function eliminarLeccion(id: string) {
  await requireAdmin()
  await prisma.britoLeccion.delete({ where: { id } })
  revalidatePath('/brito-admin')
  return { ok: true }
}

export async function buscarPreguntas(params: { area: string; texto: string }) {
  await requireAdmin()
  const preguntas = await prisma.preguntaExamen.findMany({
    where: {
      area: params.area || undefined,
      ...(params.texto ? { enunciado: { contains: params.texto, mode: 'insensitive' } } : {}),
    },
    select: { id: true, area: true, numero: true, enunciado: true },
    orderBy: { id: 'asc' },
    take: 30,
  })
  return preguntas.map(p => ({ ...p, id: p.id.toString() }))
}

export async function agregarPreguntaALeccion(leccionId: string, preguntaId: string) {
  await requireAdmin()
  const count = await prisma.britoLeccionPregunta.count({ where: { leccionId } })
  await prisma.britoLeccionPregunta.create({
    data: { leccionId, preguntaId: BigInt(preguntaId), orden: count + 1 },
  })
  revalidatePath(`/brito-admin/${leccionId}`)
  return { ok: true }
}

export async function quitarPreguntaDeLeccion(leccionId: string, preguntaId: string) {
  await requireAdmin()
  await prisma.britoLeccionPregunta.delete({
    where: { leccionId_preguntaId: { leccionId, preguntaId: BigInt(preguntaId) } },
  })
  revalidatePath(`/brito-admin/${leccionId}`)
  return { ok: true }
}

export async function crearPregunta(data: {
  area: string
  sesion: number
  enunciado: string
  contexto?: string
  opcionA: string
  opcionB: string
  opcionC: string
  opcionD: string
  correcta: string
  explicacion?: string
  imagenUrl?: string | null
}) {
  await requireAdmin()

  const enunciado = data.enunciado.trim()
  const opcionA = data.opcionA.trim()
  const opcionB = data.opcionB.trim()
  const opcionC = data.opcionC.trim()
  const opcionD = data.opcionD.trim()
  if (!enunciado || !opcionA || !opcionB || !opcionC || !opcionD) {
    return { error: 'Completa el enunciado y las 4 opciones' }
  }

  const pregunta = await prisma.preguntaExamen.create({
    data: {
      examenId: BRITO_BANCO_EXAMEN_ID,
      sesion: data.sesion,
      area: data.area,
      enunciado,
      contexto: data.contexto?.trim() || null,
      opcionA,
      opcionB,
      opcionC,
      opcionD,
      correcta: data.correcta,
      explicacion: data.explicacion?.trim() || null,
      imagenUrl: data.imagenUrl || null,
      tieneImagen: !!data.imagenUrl,
    },
  })

  revalidatePath('/brito-admin')
  return { ok: true, id: pregunta.id.toString() }
}
