/**
 * Apuntes: el bloc de notas de cada quien en Marketing (Hotman, 22-ago).
 *
 * Privado por defecto: una nota la ve su dueño y nadie más —ni el admin ni
 * la líder—, salvo con quien la comparta, de a una persona, para ver o para
 * editar. El contenido es el HTML del editor (negritas, listas, tareas...),
 * que aquí se limpia de lo que no sea formato antes de guardarse: lo que se
 * pega de afuera no puede traer scripts ni enlaces raros.
 *
 * Borrar manda a la papelera; ahí se recupera durante 30 días y después la
 * purga diaria lo saca de verdad (jobs/purgarApuntes).
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'

// ── Limpieza del HTML ─────────────────────────────────────────────────────────
const ETIQUETAS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark',
  'span', 'div', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr', 'input', 'font'])
const ESTILOS = /^(color|background-color|background|text-align|font-weight|font-style|text-decoration(?:-line)?)\s*:\s*[#\w().,%\s-]+$/i

/** Deja solo el formato del editor. Sin dependencias: es una lista blanca. */
export function limpiarHtml(html: string): string {
  let s = html.slice(0, 300_000)
  s = s.replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g, (_todo, cierre: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    if (!ETIQUETAS.has(t)) return ''
    if (cierre) return `</${t}>`
    const limpios: string[] = []
    const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
    let m: RegExpExecArray | null
    while ((m = re.exec(attrs)) !== null) {
      const nombre = m[1].toLowerCase()
      const valor = (m[3] ?? m[4] ?? m[5] ?? '').trim()
      if (t === 'a' && nombre === 'href' && /^(https?:\/\/|mailto:|\/)/i.test(valor)) {
        limpios.push(`href="${valor.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer"`)
      } else if (t === 'input' && nombre === 'type' && valor.toLowerCase() === 'checkbox') {
        limpios.push('type="checkbox"')
      } else if (t === 'input' && nombre === 'checked') {
        limpios.push('checked')
      } else if (nombre === 'style') {
        const ok = valor.split(';').map(x => x.trim()).filter(x => x && ESTILOS.test(x))
        if (ok.length) limpios.push(`style="${ok.join('; ').replace(/"/g, '&quot;')}"`)
      } else if (nombre === 'class' && /^[\w\s-]+$/.test(valor)) {
        limpios.push(`class="${valor}"`)
      } else if (t === 'font' && nombre === 'color' && /^[#\w()., ]+$/.test(valor)) {
        limpios.push(`color="${valor}"`)
      }
    }
    return `<${t}${limpios.length ? ' ' + limpios.join(' ') : ''}>`
  })
  return s
}

// ── Acceso ───────────────────────────────────────────────────────────────────
const SELECT = {
  id: true, userId: true, titulo: true, contenido: true, etiqueta: true, color: true,
  fijado: true, archivadoEn: true, eliminadoEn: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, nombre: true, image: true } },
  compartidos: { select: { userId: true, puedeEditar: true, user: { select: { nombre: true, image: true } } } },
} as const

type Fila = NonNullable<Awaited<ReturnType<typeof buscar>>>

function buscar(id: string) {
  return prisma.apunte.findUnique({ where: { id }, select: SELECT })
}

/** Qué puede hacer quien pregunta con esta nota. */
function permisoDe(a: Fila, userId: string): 'dueno' | 'editar' | 'ver' | null {
  if (a.userId === userId) return 'dueno'
  const c = a.compartidos.find(x => x.userId === userId)
  return c ? (c.puedeEditar ? 'editar' : 'ver') : null
}

function presentar(a: Fila, userId: string) {
  return {
    id: a.id,
    titulo: a.titulo,
    contenido: a.contenido,
    etiqueta: a.etiqueta,
    color: a.color,
    fijado: a.fijado,
    archivadoEn: a.archivadoEn,
    eliminadoEn: a.eliminadoEn,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    dueno: a.user,
    compartidos: a.compartidos.map(c => ({ userId: c.userId, nombre: c.user.nombre, image: c.user.image, puedeEditar: c.puedeEditar })),
    miPermiso: permisoDe(a, userId),
  }
}

async function exigir(id: string, userId: string, minimo: 'ver' | 'editar' | 'dueno') {
  const a = await buscar(id)
  if (!a) throw new NotFoundError('Apunte no encontrado')
  const p = permisoDe(a, userId)
  const rango = { ver: 1, editar: 2, dueno: 3 } as const
  if (!p || rango[p] < rango[minimo]) throw new ForbiddenError('Este apunte no es tuyo')
  return a
}

// ── Endpoints ────────────────────────────────────────────────────────────────
export async function listar(req: Request, res: Response) {
  const userId = req.userId!
  const vista = String(req.query.vista ?? 'activas')
  const estado =
    vista === 'papelera'   ? { eliminadoEn: { not: null } } :
    vista === 'archivadas' ? { eliminadoEn: null, archivadoEn: { not: null } } :
                             { eliminadoEn: null, archivadoEn: null }
  const filas = await prisma.apunte.findMany({
    where: { ...estado, OR: [{ userId }, { compartidos: { some: { userId } } }] },
    select: SELECT,
    orderBy: [{ fijado: 'desc' }, { updatedAt: 'desc' }],
  })
  return ApiResponse.success(res, filas.map(a => presentar(a, userId)))
}

const crearSchema = z.object({
  titulo:    z.string().max(200).optional(),
  contenido: z.string().optional(),
  etiqueta:  z.string().max(40).optional().nullable(),
  color:     z.string().max(20).optional().nullable(),
})

export async function crear(req: Request, res: Response) {
  const data = crearSchema.parse(req.body)
  const a = await prisma.apunte.create({
    data: {
      userId: req.userId!,
      titulo: data.titulo ?? '',
      contenido: limpiarHtml(data.contenido ?? ''),
      etiqueta: data.etiqueta ?? null,
      color: data.color ?? null,
    },
    select: SELECT,
  })
  return ApiResponse.created(res, presentar(a, req.userId!))
}

const actualizarSchema = z.object({
  titulo:    z.string().max(200).optional(),
  contenido: z.string().optional(),
  etiqueta:  z.string().max(40).optional().nullable(),
  color:     z.string().max(20).optional().nullable(),
  fijado:    z.boolean().optional(),
  archivado: z.boolean().optional(),
  eliminado: z.boolean().optional(),
})

export async function actualizar(req: Request, res: Response) {
  const data = actualizarSchema.parse(req.body)
  const tocaOrganizar = data.etiqueta !== undefined || data.color !== undefined ||
    data.fijado !== undefined || data.archivado !== undefined || data.eliminado !== undefined
  // Quien solo puede editar cambia texto; fijar, etiquetar, archivar o borrar
  // es del dueño.
  await exigir(req.params.id, req.userId!, tocaOrganizar ? 'dueno' : 'editar')

  const a = await prisma.apunte.update({
    where: { id: req.params.id },
    data: {
      ...(data.titulo !== undefined ? { titulo: data.titulo } : {}),
      ...(data.contenido !== undefined ? { contenido: limpiarHtml(data.contenido) } : {}),
      ...(data.etiqueta !== undefined ? { etiqueta: data.etiqueta } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.fijado !== undefined ? { fijado: data.fijado } : {}),
      ...(data.archivado !== undefined ? { archivadoEn: data.archivado ? new Date() : null } : {}),
      ...(data.eliminado !== undefined ? { eliminadoEn: data.eliminado ? new Date() : null } : {}),
    },
    select: SELECT,
  })
  return ApiResponse.success(res, presentar(a, req.userId!))
}

/** Sacar de la papelera de verdad. Solo el dueño, y solo lo que ya está en ella. */
export async function eliminarDefinitivo(req: Request, res: Response) {
  const a = await exigir(req.params.id, req.userId!, 'dueno')
  if (!a.eliminadoEn) throw new ValidationError('Primero va a la papelera; desde ahí se elimina del todo')
  await prisma.apunte.delete({ where: { id: a.id } })
  return ApiResponse.noContent(res)
}

/** Una copia a nombre de quien la pide: sirve de plantilla. */
export async function duplicar(req: Request, res: Response) {
  const a = await exigir(req.params.id, req.userId!, 'ver')
  const copia = await prisma.apunte.create({
    data: {
      userId: req.userId!,
      titulo: a.titulo ? `${a.titulo} (copia)` : '',
      contenido: a.contenido,
      etiqueta: a.etiqueta,
      color: a.color,
    },
    select: SELECT,
  })
  return ApiResponse.created(res, presentar(copia, req.userId!))
}

const compartirSchema = z.object({
  userId:      z.string().min(1),
  puedeEditar: z.boolean().optional(),
})

export async function compartir(req: Request, res: Response) {
  const { userId, puedeEditar } = compartirSchema.parse(req.body)
  const a = await exigir(req.params.id, req.userId!, 'dueno')
  if (userId === a.userId) throw new ValidationError('Ya es tuyo')
  await prisma.apunteCompartido.upsert({
    where:  { apunteId_userId: { apunteId: a.id, userId } },
    update: { puedeEditar: !!puedeEditar },
    create: { apunteId: a.id, userId, puedeEditar: !!puedeEditar },
  })
  return ApiResponse.success(res, presentar((await buscar(a.id))!, req.userId!))
}

export async function dejarDeCompartir(req: Request, res: Response) {
  const a = await exigir(req.params.id, req.userId!, 'dueno')
  await prisma.apunteCompartido.deleteMany({ where: { apunteId: a.id, userId: req.params.userId } })
  return ApiResponse.success(res, presentar((await buscar(a.id))!, req.userId!))
}
