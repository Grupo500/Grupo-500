'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Guarda (o quita) la URL de imagen de una pregunta. Solo admin.
export async function guardarImagenPregunta(preguntaId: string, url: string | null) {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (role !== 'ADMIN') return { error: 'No autorizado' }

  await prisma.preguntaExamen.update({
    where: { id: BigInt(preguntaId) },
    data: { imagenUrl: url, tieneImagen: !!url },
  })

  revalidatePath('/examenes/admin/imagenes')
  return { ok: true }
}
