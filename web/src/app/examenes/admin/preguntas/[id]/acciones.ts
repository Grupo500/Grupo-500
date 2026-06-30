'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function editarPregunta(preguntaId: string, data: {
  enunciado: string
  contexto: string | null
  opcionA: string | null
  opcionB: string | null
  opcionC: string | null
  opcionD: string | null
  correcta: string
  area: string | null
  explicacion: string | null
}) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Sin permiso' }

  const updated = await prisma.preguntaExamen.update({
    where: { id: BigInt(preguntaId) },
    data: {
      enunciado:   data.enunciado.trim(),
      contexto:    data.contexto?.trim()    || null,
      opcionA:     data.opcionA?.trim()     || null,
      opcionB:     data.opcionB?.trim()     || null,
      opcionC:     data.opcionC?.trim()     || null,
      opcionD:     data.opcionD?.trim()     || null,
      correcta:    data.correcta.trim().toUpperCase().slice(0, 1),
      area:        data.area?.trim()        || null,
      explicacion: data.explicacion?.trim() || null,
    },
    select: { examenId: true },
  })

  redirect(`/examenes/admin/imagenes?sim=${updated.examenId}`)
}
