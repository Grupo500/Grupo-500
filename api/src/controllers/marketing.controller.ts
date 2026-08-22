import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { esLiderMarketing } from '../utils/roles'
import { datosFinancierosDe, SELECT_FINANCIEROS } from '../utils/cuentaCobro'
import { sendPushToUser } from '../services/push'
import { avisar } from '../services/notificaciones'
import { broadcast } from '../utils/sseManager'
import { z } from 'zod'

/** El nombre de pila de quien provoca un aviso, para redactarlo. */
async function nombreDe(userId?: string) {
  if (!userId) return 'Alguien'
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nombre: true } })
  return u?.nombre?.trim() || 'Alguien'
}

/** El día de una tarea en palabras: "21 de agosto". */
function enPalabras(fecha: Date) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  // La fecha se guarda a medianoche UTC; se lee en UTC para no correrla un día.
  return `${fecha.getUTCDate()} de ${meses[fecha.getUTCMonth()]}`
}

/** La corrección, cortada para que quepa en una línea de la bandeja. */
const recorte = (t: string) => (t.length > 80 ? t.slice(0, 80).trimEnd() + '…' : t)

const enPesos = (n: number) => '$' + n.toLocaleString('es-CO')

const SELECT_MIEMBRO = { id: true, nombre: true, activo: true, userId: true, user: { select: { image: true, role: true } } }

// ── Miembros del equipo ──────────────────────────────────────────────────────
export async function listarMiembros(req: Request, res: Response) {
  const soloActivos = req.query.activo !== 'false'
  const miembros = await prisma.miembroMarketing.findMany({
    where: soloActivos ? { activo: true } : {},
    select: SELECT_MIEMBRO,
    orderBy: { nombre: 'asc' },
  })
  // El rol se aplana: quien asigna trabajo necesita saber quién es editor de
  // video, y anidarlo dentro de user obligaba a cada pantalla a bajarlo.
  return ApiResponse.success(res, miembros.map(m => ({ ...m, rol: m.user?.role ?? null })))
}

// ── Contenidos (calendario) ──────────────────────────────────────────────────
const rangoSchema = z.object({
  desde: z.string(),
  hasta: z.string(),
})

/**
 * Quién puede repartir trabajo: community managers, líderes y administradores.
 * Un editor no asigna — recibe. Su contenido queda a su nombre solo.
 */
const PUEDE_ASIGNAR: string[] = ['ADMIN', 'COMMUNITY', 'SOCIAL_MEDIA', 'LIDER_EDICION', 'LIDER_DISENO']
const puedeAsignar = (rol?: string) => PUEDE_ASIGNAR.includes(rol ?? '')

/**
 * Qué contenido puede ver quien pregunta.
 *
 * El trabajo de cada quien es suyo: un editor no tiene por qué ver la carga de
 * los demás (decisión de Hotman, 20-ago). Quien reparte trabajo sí ve lo que
 * asignó, para poder revisarlo. Los administradores y la jefa de marketing
 * —`esLiderMarketing`, el mismo criterio que ya rige en Cobros— ven todo.
 *
 * Devuelve `null` cuando no hay filtro (ve todo).
 */
async function filtroVisibilidad(req: Request) {
  if (esLiderMarketing(req.userRole)) return null

  const yo = (await miMiembro(req.userId))?.id ?? '__sin_miembro__'
  // Quien asigna ve lo suyo y lo que repartió; el resto, solo lo suyo. Se usa
  // un id imposible cuando no hay ficha de marketing: ante la duda, nada.
  return puedeAsignar(req.userRole)
    ? { OR: [{ asignadoAId: yo }, { asignadoPorId: req.userId }] }
    : { asignadoAId: yo }
}

export async function listarContenidos(req: Request, res: Response) {
  const { desde, hasta } = rangoSchema.parse(req.query)
  const visible = await filtroVisibilidad(req)
  const contenidos = await prisma.contenidoMarketing.findMany({
    where: {
      fecha: {
        gte: new Date(desde + 'T00:00:00'),
        lte: new Date(hasta + 'T23:59:59'),
      },
      ...(visible ?? {}),
    },
    include: {
      asignadoA: { select: SELECT_MIEMBRO },
      entregables: true,
      correcciones: {
        orderBy: { createdAt: 'asc' }, // el hilo se lee de arriba abajo, como una conversación
        include: { pedidaPor: { select: { nombre: true, email: true, image: true } } },
      },
    },
    orderBy: { fecha: 'asc' },
  })
  return ApiResponse.success(res, contenidos)
}

const TIPO_CONTENIDO = ['VIDEO', 'HISTORIA', 'VSL', 'CARRUSEL', 'CARRUMEME', 'TIKTOKERO', 'GUION', 'PUBLICACION', 'OTRO'] as const
const DESTINO = ['SEBASTIAN_PERSONAL', 'ANDRES_PERSONAL', 'PREICFES', 'PREMEDICO'] as const
const CLASIFICACION = ['ORGANICO', 'PAUTA'] as const
const TIPO_TRABAJO  = ['EMPRESA', 'FREELANCE'] as const

// El valor solo tiene sentido en un freelance: en un trabajo de empresa se
// guarda null aunque el cliente lo mande, para que no queden importes colgando
// de trabajo interno. Se normaliza aquí y no en el formulario porque la API
// también la usan otros clientes.
function valorSegunTrabajo(
  tipoTrabajo: 'EMPRESA' | 'FREELANCE' | undefined,
  valor: number | null | undefined,
) {
  if (tipoTrabajo === 'FREELANCE') return valor ?? null
  return tipoTrabajo === 'EMPRESA' ? null : undefined
}

const crearContenidoSchema = z.object({
  titulo:        z.string().min(2),
  tipo:          z.enum(TIPO_CONTENIDO),
  destino:       z.enum(DESTINO).optional().nullable(),
  clasificacion: z.enum(CLASIFICACION).optional(),
  fecha:         z.string(),
  asignadoAId:   z.string().optional().nullable(),
  notas:         z.string().optional().nullable(),
  tipoTrabajo:   z.enum(TIPO_TRABAJO).optional(),
  valor:         z.number().int().min(0).optional().nullable(),
})

export async function crearContenido(req: Request, res: Response) {
  const data = crearContenidoSchema.parse(req.body)

  // Quien reparte trabajo (community, líderes, admin) puede poner a otro; el
  // resto crea siempre a su nombre, sin preguntar —así es como el equipo lo
  // viene haciendo—. Se guarda además quién asignó, para que pueda revisarlo
  // después (Hotman, 20-ago).
  const mio = (await miMiembro(req.userId))?.id ?? null
  const otro = puedeAsignar(req.userRole) ? data.asignadoAId ?? null : null
  const asignadoAId = otro ?? mio

  const contenido = await prisma.contenidoMarketing.create({
    data: {
      ...data,
      asignadoAId,
      // Solo cuenta como "asignado por" cuando se le encarga a alguien más:
      // apuntarse uno mismo no es repartir trabajo.
      asignadoPorId: otro && otro !== mio ? req.userId ?? null : null,
      fecha: new Date(data.fecha),
      valor: valorSegunTrabajo(data.tipoTrabajo, data.valor) ?? null,
    },
    include: { asignadoA: { select: SELECT_MIEMBRO }, entregables: true },
  })

  // Aviso a quien recibe el encargo: si se lo asignaron, tiene que enterarse
  // sin depender de que abra la app por casualidad.
  if (otro && otro !== mio) {
    const destino = await prisma.miembroMarketing.findUnique({
      where: { id: otro }, select: { userId: true },
    })
    if (destino) {
      const quien = await nombreDe(req.userId)
      void avisar({
        userId: destino.userId,
        autorId: req.userId,
        tipo: 'TAREA_ASIGNADA',
        titulo: 'Te asignaron un trabajo',
        texto: `${quien} te asignó «${contenido.titulo}» para el ${enPalabras(contenido.fecha)}.`,
        url: '/marketing/entregables',
        contenidoId: contenido.id,
      })
    }
  }

  broadcast('contenido-actualizado', { id: contenido.id })
  return ApiResponse.created(res, contenido)
}

// ── Correcciones ─────────────────────────────────────────────────────────────
const correccionSchema = z.object({ mensaje: z.string().min(3) })

/**
 * Pedir cambios sobre un trabajo. Puede hacerlo quien lo asignó, los líderes y
 * los administradores — no cualquiera del equipo: una corrección es una orden
 * de rehacer, y tiene que quedar claro de quién viene.
 */
export async function pedirCorreccion(req: Request, res: Response) {
  const { mensaje } = correccionSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.findUnique({
    where: { id: req.params.id },
    include: { asignadoA: { select: { userId: true, nombre: true } } },
  })
  if (!contenido) throw new NotFoundError('Contenido no encontrado')

  const puede = esLiderMarketing(req.userRole) || contenido.asignadoPorId === req.userId
  if (!puede) throw new ForbiddenError('Solo quien asignó el trabajo o un líder puede pedir cambios')

  const correccion = await prisma.correccionContenido.create({
    data: { contenidoId: contenido.id, mensaje, pedidaPorId: req.userId! },
    include: { pedidaPor: { select: { nombre: true, email: true, image: true } } },
  })

  // Un trabajo con cambios pedidos vuelve a estar en proceso: darlo por
  // publicado mientras hay algo que rehacer falsea el tablero.
  if (contenido.estado === 'PUBLICADO') {
    await prisma.contenidoMarketing.update({
      where: { id: contenido.id }, data: { estado: 'EN_PROCESO' },
    })
  }

  if (contenido.asignadoA?.userId) {
    const quien = await nombreDe(req.userId)
    void avisar({
      userId: contenido.asignadoA.userId,
      autorId: req.userId,
      tipo: 'CAMBIOS_PEDIDOS',
      titulo: 'Tienes correcciones en un trabajo',
      texto: `${quien} pidió cambios en «${contenido.titulo}»: «${recorte(mensaje)}»`,
      url: '/marketing/entregables',
      contenidoId: contenido.id,
    })
  }

  broadcast('contenido-actualizado', { id: contenido.id })
  auditLog(req, 'CREATE', 'marketing_correccion', correccion.id, { contenido: contenido.titulo })
  return ApiResponse.created(res, correccion)
}

/** Quien hizo el trabajo marca que ya corrigió. Avisa a quien las pidió. */
export async function resolverCorrecciones(req: Request, res: Response) {
  const contenido = await prisma.contenidoMarketing.findUnique({
    where: { id: req.params.id },
    include: {
      asignadoA: { select: { userId: true, nombre: true } },
      correcciones: { where: { resueltaEn: null }, select: { id: true, pedidaPorId: true } },
    },
  })
  if (!contenido) throw new NotFoundError('Contenido no encontrado')

  const esSuyo = contenido.asignadoA?.userId === req.userId
  if (!esSuyo && !esLiderMarketing(req.userRole)) {
    throw new ForbiddenError('Solo quien hizo el trabajo puede marcar las correcciones como hechas')
  }
  if (contenido.correcciones.length === 0) {
    throw new ValidationError('No hay correcciones pendientes')
  }

  await prisma.correccionContenido.updateMany({
    where: { contenidoId: contenido.id, resueltaEn: null },
    data: { resueltaEn: new Date() },
  })

  // Aviso de vuelta a quien las pidió, para que vaya a revisar.
  const pidieron = [...new Set(contenido.correcciones.map(c => c.pedidaPorId))]
  for (const userId of pidieron) {
    void avisar({
      userId,
      autorId: req.userId,
      tipo: 'CORRECCION_HECHA',
      titulo: 'Correcciones listas para revisar',
      texto: `${contenido.asignadoA?.nombre ?? 'El equipo'} corrigió «${contenido.titulo}» — listo para revisar.`,
      url: '/marketing/entregables',
      contenidoId: contenido.id,
    })
  }

  broadcast('contenido-actualizado', { id: contenido.id })
  return ApiResponse.success(res, { resueltas: contenido.correcciones.length })
}

/**
 * Corregir la corrección, o retirarla.
 *
 * Una corrección se escribe a las prisas y en caliente: se manda con una
 * palabra de más, o pidiendo algo que resulta que ya estaba. Sin poder
 * arreglarla, la única salida era escribir otra debajo aclarando la anterior,
 * y el hilo terminaba diciendo dos cosas distintas (Hotman, 20-ago).
 *
 * La toca quien la escribió, y los administradores. Ni siquiera los líderes
 * editan lo que pidió otra persona: sería cambiarle las palabras en la boca.
 */
async function correccionPropia(req: Request) {
  const correccion = await prisma.correccionContenido.findUnique({
    where: { id: req.params.correccionId },
    select: { id: true, pedidaPorId: true, contenidoId: true, resueltaEn: true },
  })
  if (!correccion) throw new NotFoundError('Corrección no encontrada')
  if (correccion.pedidaPorId !== req.userId && req.userRole !== 'ADMIN') {
    throw new ForbiddenError('Solo quien pidió el cambio puede modificarlo')
  }
  return correccion
}

export async function editarCorreccion(req: Request, res: Response) {
  const { mensaje } = correccionSchema.parse(req.body)
  const previa = await correccionPropia(req)
  // Ya resuelta no se toca: lo que se hizo se hizo sobre ese texto, y
  // reescribirlo después deja el trabajo respondiendo a algo que ya no dice.
  if (previa.resueltaEn) throw new ValidationError('Esta corrección ya se marcó como hecha')

  const correccion = await prisma.correccionContenido.update({
    where: { id: previa.id },
    data: { mensaje },
    include: { pedidaPor: { select: { nombre: true, email: true, image: true } } },
  })

  broadcast('contenido-actualizado', { id: previa.contenidoId })
  auditLog(req, 'UPDATE', 'marketing_correccion', correccion.id)
  return ApiResponse.success(res, correccion)
}

export async function eliminarCorreccion(req: Request, res: Response) {
  const previa = await correccionPropia(req)
  await prisma.correccionContenido.delete({ where: { id: previa.id } })

  broadcast('contenido-actualizado', { id: previa.contenidoId })
  auditLog(req, 'DELETE', 'marketing_correccion', previa.id)
  return ApiResponse.noContent(res)
}

const actualizarContenidoSchema = z.object({
  titulo:        z.string().min(2).optional(),
  tipo:          z.enum(TIPO_CONTENIDO).optional(),
  destino:       z.enum(DESTINO).optional().nullable(),
  clasificacion: z.enum(CLASIFICACION).optional(),
  fecha:         z.string().optional(),
  estado:        z.enum(['PLANIFICADO', 'EN_PROCESO', 'PUBLICADO']).optional(),
  asignadoAId:   z.string().optional().nullable(),
  notas:         z.string().optional().nullable(),
  tipoTrabajo:   z.enum(TIPO_TRABAJO).optional(),
  valor:         z.number().int().min(0).optional().nullable(),
})

export async function actualizarContenido(req: Request, res: Response) {
  const data = actualizarContenidoSchema.parse(req.body)

  const antes = await prisma.contenidoMarketing.findUnique({
    where: { id: req.params.id },
    select: { asignadoAId: true, asignadoPorId: true, titulo: true, estado: true },
  })
  if (!antes) throw new NotFoundError('Contenido no encontrado')

  // Repartir trabajo no solo pasa al crear la tarea: muchas nacen sueltas y se
  // le pasan a alguien después, desde el formulario de edición. Hasta ahora eso
  // no quedaba anotado, así que quien la repartía no podía pedirle cambios —y
  // sin motivo aparente, porque al crearla sí podía (Hotman, 20-ago). Quien
  // pone el nombre de otra persona en la tarea es quien la asignó, da igual
  // cuándo lo haga.
  const mio = (await miMiembro(req.userId))?.id ?? null
  // El selector ya no trae "A mi nombre" (Hotman, 22-ago): vacío significa "a
  // nombre de quien guarda", igual que al crear —y si quien guarda no tiene
  // ficha de marketing (un admin), se conserva el dueño actual—. Antes el
  // vacío se escribía tal cual y el trabajo quedaba al aire; así se perdieron
  // trabajos de Santiago. Quien no reparte trabajo (un editor) no toca la
  // asignación al editar, como tampoco la decide al crear.
  const { asignadoAId: asignadoPedido, ...cambios } = data
  const asignadoAId =
    asignadoPedido !== undefined && puedeAsignar(req.userRole)
      ? asignadoPedido ?? mio ?? antes.asignadoAId ?? undefined
      : undefined
  const reasignada =
    asignadoAId !== undefined &&
    asignadoAId !== antes.asignadoAId &&
    asignadoAId !== mio

  const contenido = await prisma.contenidoMarketing.update({
    where: { id: req.params.id },
    data: {
      ...cambios,
      ...(asignadoAId !== undefined ? { asignadoAId } : {}),
      ...(cambios.fecha ? { fecha: new Date(cambios.fecha) } : {}),
      ...(reasignada ? { asignadoPorId: req.userId ?? null } : {}),
      // Si el trabajo pasa a ser de empresa, el valor que tuviera se descarta.
      ...(valorSegunTrabajo(data.tipoTrabajo, data.valor) !== undefined
        ? { valor: valorSegunTrabajo(data.tipoTrabajo, data.valor) }
        : {}),
    },
    include: { asignadoA: { select: SELECT_MIEMBRO }, entregables: true },
  })

  // El mismo aviso que al crear: quien recibe el encargo tiene que enterarse
  // sin depender de que abra la app por casualidad.
  if (reasignada && contenido.asignadoA?.userId) {
    const quien = await nombreDe(req.userId)
    void avisar({
      userId: contenido.asignadoA.userId,
      autorId: req.userId,
      tipo: 'TAREA_ASIGNADA',
      titulo: 'Te asignaron un trabajo',
      texto: `${quien} te asignó «${contenido.titulo}» para el ${enPalabras(contenido.fecha)}.`,
      url: '/marketing/entregables',
      contenidoId: contenido.id,
    })
  }

  // Se publicó algo que otro repartió: quien lo encargó quiere enterarse sin
  // tener que ir a mirar.
  if (data.estado === 'PUBLICADO' && antes.estado !== 'PUBLICADO' && contenido.asignadoPorId) {
    const quien = await nombreDe(req.userId)
    void avisar({
      userId: contenido.asignadoPorId,
      autorId: req.userId,
      tipo: 'TAREA_PUBLICADA',
      titulo: 'Se publicó un trabajo',
      texto: `${quien} publicó «${contenido.titulo}».`,
      url: '/marketing/entregables',
      contenidoId: contenido.id,
    })
  }

  broadcast('contenido-actualizado', { id: contenido.id })
  return ApiResponse.success(res, contenido)
}

// Solo ADMIN o el propio asignado pueden borrar un contenido.
export async function eliminarContenido(req: Request, res: Response) {
  const contenido = await prisma.contenidoMarketing.findUnique({ where: { id: req.params.id } })
  if (!contenido) throw new NotFoundError('Contenido no encontrado')

  if (req.userRole !== 'ADMIN') {
    const miembro = await prisma.miembroMarketing.findUnique({ where: { userId: req.userId } })
    if (!miembro || contenido.asignadoAId !== miembro.id) {
      throw new ForbiddenError('Solo puedes eliminar contenido asignado a ti')
    }
  }

  await prisma.contenidoMarketing.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}

/**
 * Recordarle a alguien que le faltan datos para poder cobrar.
 *
 * Sin cédula, banco y número de cuenta no hay a dónde girar, y hasta ahora eso
 * se descubría el día del pago. El aviso lo manda quien está mirando Cobros
 * —los líderes—, con el detalle de qué falta (Hotman, 20-ago).
 */
export async function recordarDatos(req: Request, res: Response) {
  if (!esLiderMarketing(req.userRole)) {
    throw new ForbiddenError('Solo los líderes piden estos datos')
  }

  const miembro = await prisma.miembroMarketing.findUnique({
    where: { id: req.params.id },
    select: { userId: true, nombre: true, ...SELECT_FINANCIEROS },
  })
  if (!miembro) throw new NotFoundError('Esa persona no está en el equipo')

  const { falta } = datosFinancierosDe(miembro)
  if (falta.length === 0) throw new ValidationError('Ya tiene todos sus datos')

  const quien = await nombreDe(req.userId)
  await avisar({
    userId: miembro.userId,
    autorId: req.userId,
    tipo: 'CAMBIOS_PEDIDOS',
    titulo: 'Te faltan datos para cobrar',
    texto: `${quien} necesita ${falta.join(', ')} para poder pagarte. Se llenan una sola vez en Ajustes.`,
    url: '/ajustes',
  })

  auditLog(req, 'CREATE', 'recordatorio_datos', miembro.userId)
  return ApiResponse.success(res, { faltan: falta.length })
}

// ── Entregables ───────────────────────────────────────────────────────────
const crearEntregableSchema = z.object({
  plataforma: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'DRIVE', 'OTRO']),
  url:        z.string().url().optional().nullable(),
  videoUrl:   z.string().url().optional().nullable(),
}).refine(d => d.url || d.videoUrl, { message: 'Se requiere un link o un video subido' })

export async function crearEntregable(req: Request, res: Response) {
  const data = crearEntregableSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.findUnique({ where: { id: req.params.id } })
  if (!contenido) throw new NotFoundError('Contenido no encontrado')

  const entregable = await prisma.entregable.create({
    data: { ...data, contenidoId: req.params.id },
  })
  // Publicar un entregable implica que el contenido ya quedó listo.
  await prisma.contenidoMarketing.update({ where: { id: req.params.id }, data: { estado: 'PUBLICADO' } })
  broadcast('contenido-actualizado', { id: req.params.id })
  return ApiResponse.created(res, entregable)
}

export async function eliminarEntregable(req: Request, res: Response) {
  await prisma.entregable.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}

export async function listarEntregables(req: Request, res: Response) {
  const { desde, hasta, plataforma } = req.query
  const entregables = await prisma.entregable.findMany({
    where: {
      ...(desde && hasta ? {
        publicadoEn: { gte: new Date(String(desde) + 'T00:00:00'), lte: new Date(String(hasta) + 'T23:59:59') },
      } : {}),
      ...(plataforma ? { plataforma: String(plataforma) as any } : {}),
    },
    include: {
      contenido: { include: { asignadoA: { select: SELECT_MIEMBRO } } },
    },
    orderBy: { publicadoEn: 'desc' },
  })
  return ApiResponse.success(res, entregables)
}

// ── Guiones ───────────────────────────────────────────────────────────────





// Solo ADMIN o el propio autor pueden borrar un guion.

// ───────────────────────────────────────────────────────────────────────────
// Cobros freelance
//
// El cobro no es una tabla aparte: es el contenido visto desde el dinero. Un
// trabajo freelance ES un cobro, así que separarlos obligaría a mantener dos
// filas sincronizadas para el mismo hecho.
//
// Quién ve qué: los líderes y el admin ven los de todo el equipo y son los que
// aprueban; el resto ve solo los suyos. Lo que cobra un editor no es asunto de
// los demás editores.
// ───────────────────────────────────────────────────────────────────────────

const SELECT_COBRO = {
  id: true, titulo: true, tipo: true, fecha: true, estado: true,
  valor: true, estadoCobro: true, aprobadoEn: true, pagadoEn: true,
  cuentaCobroUrl: true, cuentaCobroEn: true,
  // Los datos financieros viajan solo aquí, no en SELECT_MIEMBRO: en el
  // calendario los vería todo el equipo, y a esta consulta solo llegan los
  // cobros que uno tiene permitido ver —los propios, o todos si es líder—,
  // que es justo donde hacen falta para armar la cuenta de cobro.
  asignadoA:   { select: { ...SELECT_MIEMBRO, ...SELECT_FINANCIEROS } },
  aprobadoPor: { select: { id: true, nombre: true } },
  entregables: { select: { id: true, publicadoEn: true } },
}

/** El perfil de marketing de quien consulta, o null si no tiene. */
async function miMiembro(userId?: string) {
  if (!userId) return null
  return prisma.miembroMarketing.findUnique({ where: { userId }, select: { id: true } })
}

export async function listarCobros(req: Request, res: Response) {
  const { desde, hasta, estado } = req.query
  const lider = esLiderMarketing(req.userRole)

  // Sin perfil de marketing y sin ser líder no hay nada que mostrar. Se filtra
  // con un id imposible en vez de dejar el where vacío: ante la duda, nada.
  const yo = lider ? null : (await miMiembro(req.userId))?.id ?? '__sin_miembro__'

  const where = {
    tipoTrabajo: 'FREELANCE' as const,
    ...(yo ? { asignadoAId: yo } : {}),
    ...(estado ? { estadoCobro: String(estado) as any } : {}),
    ...(desde && hasta ? { fecha: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } } : {}),
  }

  const crudos = await prisma.contenidoMarketing.findMany({
    where, select: SELECT_COBRO, orderBy: [{ estadoCobro: 'asc' }, { fecha: 'desc' }],
  })

  // A cada persona se le adjunta qué le falta para poder cobrar. Se calcula
  // aquí y no en la pantalla para que Ajustes y Cobros no puedan discrepar.
  const cobros = crudos.map(c => ({
    ...c,
    asignadoA: c.asignadoA && { ...c.asignadoA, ...datosFinancierosDe(c.asignadoA) },
  }))

  // Los totales se calculan sobre lo mismo que se lista, para que el número de
  // arriba siempre cuadre con las filas de abajo.
  const suma = (e: string) =>
    cobros.filter(c => c.estadoCobro === e).reduce((s, c) => s + (c.valor ?? 0), 0)

  return ApiResponse.success(res, {
    cobros,
    puedeAprobar: lider,
    totales: {
      porAprobar: suma('POR_APROBAR'),
      aprobado:   suma('APROBADO'),
      pagado:     suma('PAGADO'),
    },
  })
}

/**
 * Aprobar es de la líder; el resto no puede ni intentarlo.
 *
 * Aquí no se marca nada como pagado: el pago no depende de Cristal ni de
 * nadie del equipo sino de que contabilidad gire de verdad, y eso lo van a
 * registrar desde su propio módulo (Hotman, 22-ago).
 */
export async function aprobarCobro(req: Request, res: Response) {
  if (!esLiderMarketing(req.userRole)) {
    return res.status(403).json({ error: 'Solo la líder de edición o un administrador pueden hacer esto' })
  }
  const actual = await prisma.contenidoMarketing.findUnique({
    where: { id: req.params.id },
    select: { tipoTrabajo: true },
  })
  if (!actual) throw new NotFoundError('Contenido no encontrado')
  if (actual.tipoTrabajo !== 'FREELANCE') {
    throw new ValidationError('Este trabajo no es freelance, no tiene cobro que aprobar')
  }

  const quien = await miMiembro(req.userId)
  const cobro = await prisma.contenidoMarketing.update({
    where: { id: req.params.id },
    data: { estadoCobro: 'APROBADO', aprobadoEn: new Date(), ...(quien && { aprobadoPorId: quien.id }) },
    select: SELECT_COBRO,
  })
  auditLog(req, 'UPDATE', 'cobro_marketing', cobro.id, { estado: 'APROBADO', valor: cobro.valor })

  // El freelance se entera al instante de que su cobro quedó aprobado y de que
  // entra en la cuenta del sábado (Hotman, 22-ago).
  const info = await prisma.contenidoMarketing.findUnique({
    where: { id: cobro.id },
    select: { titulo: true, valor: true, asignadoA: { select: { userId: true } } },
  })
  if (info?.asignadoA?.userId) {
    void avisar({
      userId: info.asignadoA.userId,
      autorId: req.userId,
      tipo: 'CAMBIOS_PEDIDOS',
      titulo: 'Cobro aprobado',
      texto: `Te aprobaron «${info.titulo}»${info.valor ? ` por ${enPesos(info.valor)}` : ''} — entra en la cuenta de cobro del sábado.`,
      url: '/marketing/cobros',
      contenidoId: cobro.id,
    })
  }
  return ApiResponse.success(res, cobro)
}

/**
 * Aprobar de un solo golpe todo lo pendiente de una persona.
 *
 * Va como un `updateMany` con POR_APROBAR en el `where`, así que una fila que
 * ya cambió entretanto simplemente no entra: no hay forma de aprobar dos
 * veces lo mismo.
 */
const loteSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
})

export async function aprobarCobrosEnLote(req: Request, res: Response) {
  if (!esLiderMarketing(req.userRole)) {
    return res.status(403).json({ error: 'Solo la líder de edición o un administrador pueden hacer esto' })
  }
  const { ids } = loteSchema.parse(req.body)
  const quien = await miMiembro(req.userId)

  // Antes de cambiar nada se mira a quién le toca el aviso: después del
  // update ya no se distingue lo recién aprobado de lo que ya lo estaba.
  // Un solo aviso por persona, no uno por trabajo —a María José no le
  // llegan veintisiete campanazos por un clic de Cristal—.
  const porAvisar = new Map<string, { n: number; total: number }>()
  const proximos = await prisma.contenidoMarketing.findMany({
    where: { id: { in: ids }, tipoTrabajo: 'FREELANCE', estadoCobro: 'POR_APROBAR' },
    select: { valor: true, asignadoA: { select: { userId: true } } },
  })
  for (const c of proximos) {
    const u = c.asignadoA?.userId
    if (!u) continue
    const e = porAvisar.get(u) ?? { n: 0, total: 0 }
    e.n += 1
    e.total += c.valor ?? 0
    porAvisar.set(u, e)
  }

  const { count } = await prisma.contenidoMarketing.updateMany({
    where: { id: { in: ids }, tipoTrabajo: 'FREELANCE', estadoCobro: 'POR_APROBAR' },
    data: { estadoCobro: 'APROBADO', aprobadoEn: new Date(), ...(quien && { aprobadoPorId: quien.id }) },
  })

  for (const [userId, e] of porAvisar) {
    void avisar({
      userId,
      autorId: req.userId,
      tipo: 'CAMBIOS_PEDIDOS',
      titulo: e.n === 1 ? 'Cobro aprobado' : 'Cobros aprobados',
      texto: e.n === 1
        ? `Te aprobaron un trabajo por ${enPesos(e.total)} — entra en la cuenta de cobro del sábado.`
        : `Te aprobaron ${e.n} trabajos por ${enPesos(e.total)} — entran en la cuenta de cobro del sábado.`,
      url: '/marketing/cobros',
    })
  }

  auditLog(req, 'UPDATE', 'cobros_marketing_lote', ids.join(','), { count })
  return ApiResponse.success(res, { actualizados: count })
}

