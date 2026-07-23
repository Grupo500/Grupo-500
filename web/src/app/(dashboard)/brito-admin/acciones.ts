'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') throw new Error('No autorizado')
}

export async function crearLeccion(data: { materia: string; titulo: string; orden: number }) {
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
