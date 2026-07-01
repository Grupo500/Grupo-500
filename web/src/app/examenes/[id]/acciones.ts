'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calificar } from '@/lib/calificacion'

// Misma lógica que simulacros-grupo500/src/app/simulacro/[id]/acciones.ts,
// portada a Prisma/NextAuth en vez de Supabase/cookie propia.

async function estudianteActual(): Promise<string | null> {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ESTUDIANTE') return null
  return session!.user.id
}

// Guarda las respuestas de una sesión en el intento (sin finalizar)
export async function guardarRespuestas(
  examenId: number,
  sesion: 1 | 2,
  respuestas: Record<string, string>
): Promise<void> {
  const estudId = await estudianteActual()
  if (!estudId) return

  const clave = `s${sesion}`
  const intento = await prisma.intentoExamen.findUnique({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
  })

  const actual = (intento?.respuestas as Record<string, unknown>) ?? {}
  const merged = { ...actual, [clave]: respuestas } as Prisma.InputJsonValue

  await prisma.intentoExamen.update({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
    data: { respuestas: merged },
  })
}

// Pausa el cronómetro de una sesión: acumula el tiempo transcurrido desde que se
// activó y limpia la marca de "activo" (queda en `null` hasta que se reanude).
// Se llama al cerrar la pestaña o al salir del examen dentro de la app.
export async function pausarSesion(examenId: number, sesion: 1 | 2): Promise<void> {
  const estudId = await estudianteActual()
  if (!estudId) return

  const intento = await prisma.intentoExamen.findUnique({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
  })
  if (!intento) return

  const iniciadoEn = sesion === 1 ? intento.sesion1IniciadoEn : intento.sesion2IniciadoEn
  if (!iniciadoEn) return // ya estaba pausada, nada que hacer

  const transcurrido = Math.max(0, Math.floor((Date.now() - iniciadoEn.getTime()) / 1000))

  await prisma.intentoExamen.update({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
    data: sesion === 1
      ? { sesion1ConsumidoSeg: intento.sesion1ConsumidoSeg + transcurrido, sesion1IniciadoEn: null }
      : { sesion2ConsumidoSeg: intento.sesion2ConsumidoSeg + transcurrido, sesion2IniciadoEn: null },
  })
}

// Termina la sesión 1 y avanza a la sesión 2
export async function finalizarSesion1(
  examenId: number,
  respuestas: Record<string, string>
) {
  const estudId = await estudianteActual()
  if (!estudId) redirect('/sign-in')

  const intento = await prisma.intentoExamen.findUnique({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
  })

  const actual = (intento?.respuestas as Record<string, unknown>) ?? {}
  const merged = { ...actual, s1: respuestas } as Prisma.InputJsonValue

  await prisma.intentoExamen.update({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
    data: { respuestas: merged, sesionActual: 2 },
  })

  redirect(`/examenes/${examenId}?sesion=2`)
}

// Termina la sesión 2, calcula puntaje y marca como finalizado
export async function finalizarSimulacro(
  examenId: number,
  respuestasS2: Record<string, string>
) {
  const estudId = await estudianteActual()
  if (!estudId) redirect('/sign-in')

  const intento = await prisma.intentoExamen.findUnique({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
  })

  const actual = (intento?.respuestas as Record<string, unknown>) ?? {}
  const todasRespuestas = { ...actual, s2: respuestasS2 } as Prisma.InputJsonValue

  const preguntas = await prisma.preguntaExamen.findMany({
    where: { examenId },
    select: { id: true, area: true, correcta: true },
  })

  const allResp = todasRespuestas as Record<string, Record<string, string>>
  const respPlanas: Record<string, string> = {
    ...(allResp.s1 ?? {}),
    ...(allResp.s2 ?? {}),
  }

  const resultado = calificar(
    preguntas.map(p => ({ id: Number(p.id), area: p.area ?? '', correcta: p.correcta })),
    respPlanas
  )

  await prisma.intentoExamen.update({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId } },
    data: {
      respuestas: todasRespuestas,
      puntaje: resultado.global,
      correctas: resultado.correctasTotal,
      total: resultado.total,
      finalizadoAt: new Date(),
    },
  })

  redirect(`/examenes/${examenId}/resultado`)
}
