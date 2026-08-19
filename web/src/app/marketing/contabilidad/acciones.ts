'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { fechaCorta } from '@/lib/contabilidadMarketing'
import { esContabilidad, esDelArea, puedeAprobarEn } from '@/lib/rolesContabilidad'

// Reglas del módulo:
// - Quien lidera un departamento (contab_lideres) aprueba, rechaza, corrige
//   valores y envía la quincena de SU área, y de ninguna otra.
// - Contabilidad y cofundador hacen eso en todas las áreas, y además son los
//   únicos que marcan pagos, exportan y administran departamentos.
// - Una quincena ENVIADA queda congelada para el área; solo contabilidad la toca.

type Sesion = { role: string; email: string }

async function sesionArea(): Promise<Sesion | null> {
  const session = await auth()
  const role = (session?.user as any)?.role as string | undefined
  if (!role || !esDelArea(role)) return null
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
  if (!esContabilidad(s.role) && await quincenaEnviada(persona.deptId, input.quincena)) {
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
  if (!s) return { error: 'Sin permisos.' }
  const reg = await prisma.contabRegistro.findUnique({ where: { id: BigInt(id) }, include: { persona: true } })
  if (!reg) return { error: 'El registro no existe.' }
  if (!await puedeAprobarEn(s, reg.persona.deptId)) {
    return { error: 'Solo el líder del área o contabilidad aprueban registros.' }
  }
  await prisma.contabRegistro.update({
    where: { id: BigInt(id) },
    data: aprobar ? { aprobado: true, rechazado: false } : { aprobado: false },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function rechazarRegistro(
  id: string,
  rechazar: boolean,
  motivo?: string,
): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  const reg = await prisma.contabRegistro.findUnique({ where: { id: BigInt(id) }, include: { persona: true } })
  if (!reg) return { error: 'El registro no existe.' }
  if (!await puedeAprobarEn(s, reg.persona.deptId)) {
    return { error: 'Solo el líder del área o contabilidad rechazan registros.' }
  }
  // Sin motivo el rechazo no le sirve a nadie: la persona no sabe qué corregir.
  const texto = motivo?.trim() ?? ''
  if (rechazar && !texto) return { error: 'Escribe por qué se rechaza.' }

  await prisma.contabRegistro.update({
    where: { id: BigInt(id) },
    data: rechazar
      ? { rechazado: true, aprobado: false, pagado: false, motivoRechazo: texto }
      : { rechazado: false, motivoRechazo: null },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

/** Aprueba de una vez todo lo que queda pendiente en el área. */
export async function aprobarTodo(deptId: string, quincena: string): Promise<{ aprobados?: number; error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  if (!await puedeAprobarEn(s, deptId)) {
    return { error: 'Solo el líder del área o contabilidad aprueban registros.' }
  }
  const r = await prisma.contabRegistro.updateMany({
    where: { quincena, rechazado: false, aprobado: false, persona: { deptId } },
    data: { aprobado: true },
  })
  revalidatePath(RUTA, 'layout')
  return { aprobados: r.count }
}

/**
 * Corrige el valor de un registro guardando el que traía. `valor_original` se
 * escribe una sola vez: si se corrige dos veces, lo que importa es con cuánto
 * lo registró la persona, no el paso intermedio.
 */
export async function editarValor(id: string, valor: number): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  const reg = await prisma.contabRegistro.findUnique({ where: { id: BigInt(id) }, include: { persona: true } })
  if (!reg) return { error: 'El registro no existe.' }
  if (!await puedeAprobarEn(s, reg.persona.deptId)) {
    return { error: 'Solo el líder del área o contabilidad corrigen valores.' }
  }
  const nuevo = Math.round(Number(valor))
  if (!Number.isFinite(nuevo) || nuevo <= 0) return { error: 'El valor debe ser mayor a 0.' }
  if (nuevo === reg.valor) return {}

  await prisma.contabRegistro.update({
    where: { id: BigInt(id) },
    data: { valor: nuevo, valorOriginal: reg.valorOriginal ?? reg.valor },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function marcarPagado(id: string, pagado: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad marca pagos.' }
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
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad marca pagos.' }
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
  if (!await puedeAprobarEn(s, deptId)) {
    return { error: 'Solo el líder de esta área o contabilidad envían su quincena.' }
  }
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

// Paletas e íconos para departamentos nuevos (los mismos de la app original)
export async function crearDepartamento(input: {
  nombre: string
  gradiente: string
  icono: string
}): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad crea departamentos.' }
  const nombre = input.nombre.trim()
  if (!nombre) return { error: 'Escribe el nombre del departamento.' }
  const id = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
  if (!id) return { error: 'Nombre inválido.' }
  const existe = await prisma.contabDepartamento.findUnique({ where: { id } })
  if (existe) return { error: 'Ya existe un departamento con ese nombre.' }
  const max = await prisma.contabDepartamento.aggregate({ _max: { orden: true } })
  await prisma.contabDepartamento.create({
    data: { id, nombre, gradiente: input.gradiente, icono: input.icono, esBase: false, orden: (max._max.orden ?? 0) + 1 },
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


// ── Líderes de departamento ─────────────────────────────────────────────────

export async function asignarLider(deptId: string, email: string): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad asigna líderes.' }
  const correo = email.trim().toLowerCase()
  if (!correo.includes('@')) return { error: 'Escribe un correo válido.' }
  await prisma.contabLider.upsert({
    where: { deptId_email: { deptId, email: correo } },
    update: {},
    create: { deptId, email: correo },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function quitarLider(deptId: string, email: string): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad quita líderes.' }
  await prisma.contabLider.deleteMany({ where: { deptId, email } })
  revalidatePath(RUTA, 'layout')
  return {}
}

// ── Departamentos: archivar en vez de borrar ────────────────────────────────

/**
 * Quitar un departamento lo archiva. Nunca se borra: sus registros son plata
 * que alguien cobró y el historial no se toca. Si mañana se vuelve a crear con
 * el mismo nombre, reaparece con todo lo suyo.
 */
export async function archivarDepartamento(deptId: string, archivar: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad administra departamentos.' }
  const dept = await prisma.contabDepartamento.findUnique({ where: { id: deptId } })
  if (!dept) return { error: 'El departamento no existe.' }
  if (dept.esBase && archivar) return { error: 'Los departamentos de fábrica no se pueden quitar.' }

  await prisma.contabDepartamento.update({ where: { id: deptId }, data: { archivado: archivar } })
  revalidatePath(RUTA, 'layout')
  return {}
}

// ── Tarifario del área ──────────────────────────────────────────────────────

export async function crearTarifa(deptId: string, label: string, valor: number): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  if (!await puedeAprobarEn(s, deptId)) return { error: 'Solo el líder del área o contabilidad editan el tarifario.' }
  const monto = Math.round(Number(valor))
  if (!label.trim()) return { error: 'Ponle nombre a la tarifa.' }
  if (!Number.isFinite(monto) || monto <= 0) return { error: 'El valor debe ser mayor a 0.' }

  await prisma.contabTarifa.create({ data: { deptId, label: label.trim(), valor: monto } })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function eliminarTarifa(id: string): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!s) return { error: 'Sin permisos.' }
  const tarifa = await prisma.contabTarifa.findUnique({ where: { id } })
  if (!tarifa) return {}
  if (!tarifa.deptId || !await puedeAprobarEn(s, tarifa.deptId)) {
    return { error: 'Solo el líder del área o contabilidad editan el tarifario.' }
  }
  await prisma.contabTarifa.delete({ where: { id } })
  revalidatePath(RUTA, 'layout')
  return {}
}

// ── Nómina fija ─────────────────────────────────────────────────────────────
// Sueldos de contrato: los registra contabilidad y no pasan por aprobación ni
// por el envío de quincena del área.

export async function crearNomina(input: {
  personaId: string
  quincena: string
  concepto: string
  valor: number
}): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad registra la nómina fija.' }
  const monto = Math.round(Number(input.valor))
  if (!input.concepto.trim()) return { error: 'Escribe el concepto.' }
  if (!Number.isFinite(monto) || monto <= 0) return { error: 'El valor debe ser mayor a 0.' }

  await prisma.contabNomina.create({
    data: {
      personaId: input.personaId,
      quincena: input.quincena,
      concepto: input.concepto.trim(),
      valor: monto,
    },
  })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function eliminarNomina(id: string): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad administra la nómina fija.' }
  await prisma.contabNomina.delete({ where: { id: BigInt(id) } })
  revalidatePath(RUTA, 'layout')
  return {}
}

export async function marcarNominaPagada(id: string, pagado: boolean): Promise<{ error?: string }> {
  const s = await sesionArea()
  if (!esContabilidad(s?.role)) return { error: 'Solo contabilidad marca pagos.' }
  await prisma.contabNomina.update({ where: { id: BigInt(id) }, data: { pagado } })
  revalidatePath(RUTA, 'layout')
  return {}
}
