'use server'

import { revalidatePath } from 'next/cache'
import { auth, hashDocumento } from '@/auth'
import { prisma } from '@/lib/prisma'
import { BRITO_BANCO_EXAMEN_ID } from '@/lib/britoBanco'

// Carga masiva de estudiantes y accesos por CSV (PRD simulacros §4.3).
// Reglas: valida fila por fila y reporta errores SIN abortar la carga completa;
// el cruce con productos es por el ID interno del examen; el documento jamás
// se guarda en claro (solo su hash, igual que en el login).

export type ReporteCarga = {
  ok: boolean
  error?: string
  total: number
  estudiantesCreados: number
  estudiantesActualizados: number
  accesosNuevos: number
  accesosReactivados: number
  colegiosCreados: string[]
  errores: { fila: number; error: string }[]
}

const vacio = (extra?: Partial<ReporteCarga>): ReporteCarga => ({
  ok: false, total: 0, estudiantesCreados: 0, estudiantesActualizados: 0,
  accesosNuevos: 0, accesosReactivados: 0, colegiosCreados: [], errores: [], ...extra,
})

// Normaliza un encabezado: minúsculas, sin tildes, sin espacios sobrantes
function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')
}

// Parser de CSV con soporte de comillas y detección de delimitador
// (Excel en es-CO exporta con «;», Sheets con «,»)
function parsearCsv(texto: string): string[][] {
  const sinBom = texto.replace(/^﻿/, '')
  const primeraLinea = sinBom.split(/\r?\n/, 1)[0] ?? ''
  const delim = (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ';' : ','

  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let enComillas = false

  for (let i = 0; i < sinBom.length; i++) {
    const c = sinBom[i]
    if (enComillas) {
      if (c === '"') {
        if (sinBom[i + 1] === '"') { celda += '"'; i++ } else enComillas = false
      } else celda += c
    } else if (c === '"') {
      enComillas = true
    } else if (c === delim) {
      fila.push(celda); celda = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && sinBom[i + 1] === '\n') i++
      fila.push(celda); celda = ''
      if (fila.some(v => v.trim() !== '')) filas.push(fila)
      fila = []
    } else celda += c
  }
  fila.push(celda)
  if (fila.some(v => v.trim() !== '')) filas.push(fila)
  return filas
}

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function cargarCsv(formData: FormData): Promise<ReporteCarga> {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') {
    return vacio({ error: 'Solo un administrador puede cargar accesos.' })
  }

  const archivo = formData.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return vacio({ error: 'Selecciona un archivo CSV.' })
  }
  if (archivo.size > 2 * 1024 * 1024) {
    return vacio({ error: 'El archivo supera 2 MB. Divide la carga en partes.' })
  }

  const texto = Buffer.from(await archivo.arrayBuffer()).toString('utf-8')
  const filas = parsearCsv(texto)
  if (filas.length < 2) {
    return vacio({ error: 'El CSV no tiene filas de datos (solo encabezado o vacío).' })
  }

  // Mapeo de columnas por nombre de encabezado (tolerante a variantes)
  const encabezados = filas[0].map(normalizar)
  const col = (...nombres: string[]) => encabezados.findIndex(h => nombres.includes(h))
  const iNombre = col('nombre', 'nombre_del_estudiante', 'estudiante')
  const iCorreo = col('correo', 'correo_electronico', 'email')
  const iDocumento = col('documento', 'numero_de_identificacion', 'identificacion', 'cedula')
  const iTipoDoc = col('tipo_documento', 'tipo_de_identificacion', 'tipo')
  const iColegio = col('colegio', 'colegio_aliado', 'institucion')
  const iProductos = col('productos', 'ids_productos', 'producto', 'simulacros', 'ids')

  const faltantes = [
    iNombre < 0 && 'nombre', iCorreo < 0 && 'correo',
    iDocumento < 0 && 'documento', iProductos < 0 && 'productos',
  ].filter(Boolean)
  if (faltantes.length) {
    return vacio({ error: `Faltan columnas obligatorias en el encabezado: ${faltantes.join(', ')}.` })
  }

  // Catálogos precargados: exámenes válidos y colegios por nombre
  const examenes = await prisma.examen.findMany({
    where: { id: { not: BRITO_BANCO_EXAMEN_ID } },
    select: { id: true },
  })
  const idsValidos = new Set(examenes.map(e => e.id))

  const colegios = await prisma.colegio.findMany({ select: { id: true, nombre: true } })
  const colegioPorNombre = new Map(colegios.map(c => [normalizar(c.nombre), c.id]))

  const reporte = vacio({ ok: true, total: filas.length - 1 })

  for (let f = 1; f < filas.length; f++) {
    const fila = filas[f]
    const numFila = f + 1 // 1-indexado contando el encabezado, como lo ve el admin en Excel

    try {
      const nombre = (fila[iNombre] ?? '').trim()
      const correo = (fila[iCorreo] ?? '').trim().toLowerCase()
      const documento = (fila[iDocumento] ?? '').replace(/[\s.]/g, '')
      const tipoDoc = iTipoDoc >= 0 ? (fila[iTipoDoc] ?? '').trim().toUpperCase() || null : null
      const colegioNombre = iColegio >= 0 ? (fila[iColegio] ?? '').trim() : ''
      const productosRaw = (fila[iProductos] ?? '').trim()

      if (!nombre) { reporte.errores.push({ fila: numFila, error: 'Nombre vacío.' }); continue }
      if (!RE_CORREO.test(correo)) { reporte.errores.push({ fila: numFila, error: `Correo inválido: «${correo || '(vacío)'}».` }); continue }
      if (!documento) { reporte.errores.push({ fila: numFila, error: 'Documento vacío (es la contraseña del estudiante).' }); continue }

      const idsProducto = productosRaw.split(/[;|\s]+/).filter(Boolean).map(Number)
      if (idsProducto.length === 0 || idsProducto.some(isNaN)) {
        reporte.errores.push({ fila: numFila, error: `Productos ilegibles: «${productosRaw || '(vacío)'}». Usa IDs separados por espacio, «;» o «|».` })
        continue
      }
      const idsInvalidos = idsProducto.filter(id => !idsValidos.has(id))
      if (idsInvalidos.length) {
        reporte.errores.push({ fila: numFila, error: `IDs de producto inexistentes: ${idsInvalidos.join(', ')}.` })
        continue
      }

      // Colegio: se cruza por nombre; si no existe se crea y se reporta
      let colegioId: string | null = null
      if (colegioNombre) {
        const clave = normalizar(colegioNombre)
        colegioId = colegioPorNombre.get(clave) ?? null
        if (!colegioId) {
          const nuevo = await prisma.colegio.create({
            data: { nombre: colegioNombre, ciudad: 'Por definir' },
          })
          colegioId = nuevo.id
          colegioPorNombre.set(clave, nuevo.id)
          reporte.colegiosCreados.push(colegioNombre)
        }
      }

      const existente = await prisma.estudianteExamen.findUnique({ where: { email: correo } })
      const datos = {
        nombre,
        documentoHash: hashDocumento(documento),
        tipoDocumento: tipoDoc,
        ...(colegioId ? { colegioId } : {}),
      }
      const estudiante = existente
        ? await prisma.estudianteExamen.update({ where: { email: correo }, data: datos })
        : await prisma.estudianteExamen.create({ data: { email: correo, ...datos } })
      if (existente) reporte.estudiantesActualizados++
      else reporte.estudiantesCreados++

      for (const examenId of new Set(idsProducto)) {
        const acceso = await prisma.accesoExamen.findUnique({
          where: { estudianteId_examenId: { estudianteId: estudiante.id, examenId } },
        })
        if (!acceso) {
          await prisma.accesoExamen.create({ data: { estudianteId: estudiante.id, examenId } })
          reporte.accesosNuevos++
        } else if (acceso.retiradoAt) {
          await prisma.accesoExamen.update({ where: { id: acceso.id }, data: { retiradoAt: null } })
          reporte.accesosReactivados++
        }
      }
    } catch (e) {
      reporte.errores.push({ fila: numFila, error: e instanceof Error ? e.message : 'Error inesperado en la fila.' })
    }
  }

  revalidatePath('/examenes/admin/accesos')
  return reporte
}

// Retira todos los accesos activos de un examen (baja de producto, PRD §6.2):
// se oculta a los estudiantes sin borrar datos ni resultados históricos.
export async function retirarAccesosDeExamen(examenId: number): Promise<{ retirados: number } | { error: string }> {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') return { error: 'Solo administradores.' }

  const r = await prisma.accesoExamen.updateMany({
    where: { examenId, retiradoAt: null },
    data: { retiradoAt: new Date() },
  })
  revalidatePath('/examenes/admin/accesos')
  return { retirados: r.count }
}
