'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fechaCorta } from '@/lib/contabilidadMarketing'

// Reglas del módulo (heredadas de la app original de pagos de agencia):
// - Los roles del área (MARKETING/EDITOR/COMMUNITY) actúan como "líder":
//   registran actividades, marcan revisado y envían la quincena.
// - Solo ADMIN es "contabilidad": aprueba/rechaza, marca pagado y exporta.
// - Una quincena ENVIADA queda congelada para el líder (solo ADMIN la toca).

type Sesion = { role: string; email: string }

async function sesionArea(): Promise<Sesion | null> {
  const session = await auth()
  const role = (session?.user as any)?.role as string | undefined
  if (!role || !['ADMIN', 'MARKETING', 'EDITOR', 'COMMUNITY'].includes(role)) return null
  return { role, email: session!.user.email ?? '' }
}

const RUTA = '/marketing/contabilidad'

async function quincenaEnviada(deptId: string, quincena: string): Promise<boolean> {
  const envio = await prisma.contabEnvio.findUnique({ where: { deptId_quincena: { deptId, quincena } } })
  return !!envio
}

export async function crearRegistro(input: {
  personaId: string
  quincena: string
  categoria: string
  actividad: string
  valor: number
  link?: string
}): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }

  const persona = await prisma.contabPersona.findUnique({ where: { id: input.personaId } })
  if (!persona) return { error: 'La persona no existe.' }
  if (s.role !== 'ADMIN' && await quincenaEnviada(persona.deptId, input.quincena)) {
    return { error: 'La quincena ya fue enviada a contabilidad: no se pueden agregar registros.' }
  }
  const valor = Math.round(Number(input.valor))
  if (!input.actividad.trim()) return { error: 'Describe la actividad.' }
  if (!Number.isFinite(valor) || valor <= 0) return { error: 'El valor debe ser mayor a 0.' }

  await prisma.contabRegistro.create({
    data: {
      personaId: input.personaId,
      quincena: input.quincena,
      categoria: input.categoria || 'Otra actividad',
      actividad: input.actividad.trim(),
      valor,
      fecha: fechaCorta(),
      link: input.link?.trim() || null,
    },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function eliminarRegistro(id: string): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  const reg = await prisma.contabRegistro.findUnique({ where: { id: BigInt(id) }, include: { persona: true } })
  if (!reg) return {}
  if (s.role !== 'ADMIN') {
    if (reg.aprobado || reg.pagado) return { error: 'Un registro aprobado o pagado solo lo elimina contabilidad.' }
    if (await quincenaEnviada(reg.persona.deptId, reg.quincena)) return { error: 'La quincena ya fue enviada.' }
  }
  await prisma.contabRegistro.delete({ where: { id: BigInt(id) } })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function marcarRevisado(id: string, valor: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  await prisma.contabRegistro.update({ where: { id: BigInt(id) }, data: { revisado: valor } })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function aprobarRegistro(id: string, aprobar: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (s?.role !== 'ADMIN') return { error: 'Solo contabilidad aprueba registros.' }
  await prisma.contabRegistro.update({
    where: { id: BigInt(id) },
    data: aprobar ? { aprobado: true, rechazado: false } : { aprobado: false },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function rechazarRegistro(id: string, rechazar: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (s?.role !== 'ADMIN') return { error: 'Solo contabilidad rechaza registros.' }
  await prisma.contabRegistro.update({
    where: { id: BigInt(id) },
    data: rechazar ? { rechazado: true, aprobado: false, pagado: false } : { rechazado: false },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function marcarPagado(id: string, pagado: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (s?.role !== 'ADMIN') return { error: 'Solo contabilidad marca pagos.' }
  await prisma.contabRegistro.update({
    where: { id: BigInt(id) },
    data: pagado ? { pagado: true, aprobado: true, rechazado: false } : { pagado: false },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

/** Marca como pagados todos los registros aprobados de una persona en la quincena. */
export async function pagarQuincenaPersona(personaId: string, quincena: string): Promise<{ pagados?: number; error?: string }> {
  const s = await sesionArea()
  if (s?.role !== 'ADMIN') return { error: 'Solo contabilidad marca pagos.' }
  const r = await prisma.contabRegistro.updateMany({
    where: { personaId, quincena, aprobado: true, rechazado: false, pagado: false },
    data: { pagado: true },
  })
  revalidatePath(RUTA, 'layout')
  return { pagados: r.count }
}

export async function enviarQuincena(deptId: string, quincena: string): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  if (await quincenaEnviada(deptId, quincena)) return { error: 'Esta quincena ya fue enviada.' }

  const registros = await prisma.contabRegistro.findMany({
    where: { quincena, persona: { deptId } },
    select: { valor: true, personaId: true },
  })
  if (registros.length === 0) return { error: 'No hay registros en esta quincena para enviar.' }

  await prisma.contabEnvio.create({
    data: {
      deptId,
      quincena,
      enviadoAt: new Date(),
      por: s.email,
      total: registros.reduce((a, r) => a + r.valor, 0),
      personas: new Set(registros.map(r => r.personaId)).size,
    },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function crearPersona(input: {
  deptId: string
  nombre: string
  cedula?: string
  rolTexto?: string
}): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  const nombre = input.nombre.trim()
  if (!nombre) return { error: 'Escribe el nombre.' }
  const slug = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  const existe = await prisma.contabPersona.findUnique({ where: { deptId_slug: { deptId: input.deptId, slug } } })
  if (existe) return { error: 'Ya existe una persona con ese nombre en el departamento.' }
  await prisma.contabPersona.create({
    data: {
      deptId: input.deptId, slug, nombre,
      cedula: input.cedula?.trim() || null,
      rolTexto: input.rolTexto?.trim() || null,
    },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}
