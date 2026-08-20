/**
 * Los avisos que quedan guardados dentro de la app.
 *
 * Vive aparte porque lo llaman sitios que no se conocen entre sí —crear una
 * tarea, pedir cambios, resolverlos— y porque cada aviso tiene que hacer dos
 * cosas a la vez: guardarse aquí y salir como notificación del navegador. Que
 * eso se decida en un solo lugar evita que un flujo avise por push y no deje
 * rastro, como pasaba hasta ahora (Hotman, 20-ago).
 *
 * El push es el refuerzo, no el aviso: si la persona no dio permiso o tenía el
 * equipo apagado, el aviso sigue esperándola en la campana.
 */

import { prisma } from '../config/prisma'
import { sendPushToUser } from './push'
import { broadcast } from '../utils/sseManager'

export type TipoNotificacion =
  | 'TAREA_ASIGNADA'
  | 'CAMBIOS_PEDIDOS'
  | 'CORRECCION_HECHA'
  | 'TAREA_PUBLICADA'

interface Aviso {
  /** A quién le llega. */
  userId: string
  /** Quién lo provocó. Se ignora si es la misma persona: nadie se avisa a sí mismo. */
  autorId?: string | null
  tipo: TipoNotificacion
  /** Lo que se lee en la bandeja, ya redactado. */
  texto: string
  /** El título corto del push del navegador. */
  titulo: string
  url: string
  contenidoId?: string | null
}

export async function avisar(a: Aviso) {
  // Nadie necesita que le avisen de lo que acaba de hacer.
  if (a.autorId && a.autorId === a.userId) return

  try {
    await prisma.notificacion.create({
      data: {
        userId: a.userId,
        autorId: a.autorId ?? null,
        tipo: a.tipo,
        texto: a.texto,
        url: a.url,
        contenidoId: a.contenidoId ?? null,
      },
    })
    // Para que el globito de la campana suba solo, sin recargar.
    broadcast('notificacion-nueva', { userId: a.userId })
  } catch {
    // Un aviso que no se puede guardar no debe tumbar la acción que lo
    // provocó: la tarea se asignó igual, y eso es lo que importa.
  }

  void sendPushToUser(a.userId, {
    title: a.titulo,
    body: a.texto,
    url: a.url,
  }).catch(() => {})
}
