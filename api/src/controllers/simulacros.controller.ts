import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { extraerResultadosDePDF, extraerResultadosDeExcel, matchearConDB } from '../services/simulacro.service'
import fetch from 'node-fetch'

export async function listar(req: Request, res: Response) {
  const { nombre, page = '1', limit = '20' } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where = {
    ...(nombre && { nombre: { contains: String(nombre), mode: 'insensitive' as const } }),
  }

  const [simulacros, total] = await Promise.all([
    prisma.simulacro.findMany({
      where,
      include: {
        estudiantes: {
          include: { estudiante: { select: { nombre: true } } },
          orderBy: { puntajeTotal: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.simulacro.count({ where }),
  ])

  return ApiResponse.paginated(res, simulacros, total, Number(page), Number(limit))
}

export async function subir(req: Request, res: Response) {
  const { nombre, archivoUrl, tipoArchivo } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })

  const simulacro = await prisma.simulacro.create({
    data: { nombre, archivoUrl: archivoUrl ?? '', tipoArchivo: tipoArchivo ?? 'pdf' },
  })

  return ApiResponse.created(res, simulacro)
}

export async function analizar(req: Request, res: Response) {
  const { id } = req.params

  const simulacro = await prisma.simulacro.findUnique({
    where: { id },
    include: { estudiantes: true },
  })
  if (!simulacro) throw new NotFoundError('Simulacro no encontrado')
  if (!simulacro.archivoUrl) {
    return res.status(400).json({ error: 'El simulacro no tiene archivo PDF adjunto' })
  }

  // ── 1. Descargar PDF desde Cloudinary ────────────────────────────────────
  const parsedUrl = new URL(simulacro.archivoUrl)
  const allowedHosts = ['res.cloudinary.com', 'api.cloudinary.com']
  if (!allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {
    return res.status(400).json({ error: 'URL de archivo no permitida' })
  }

  console.log(`[analizar] Descargando PDF: ${simulacro.archivoUrl}`)
  const pdfRes = await fetch(simulacro.archivoUrl, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!pdfRes.ok) {
    console.error(`[analizar] Error descargando PDF: ${pdfRes.status} ${pdfRes.statusText}`)
    return res.status(502).json({ error: 'No se pudo descargar el PDF desde Cloudinary' })
  }
  const contentLength = Number(pdfRes.headers.get('content-length') ?? 0)
  if (contentLength > 50 * 1024 * 1024) {
    return res.status(413).json({ error: 'El archivo PDF supera el límite de 50 MB' })
  }
  const buffer = Buffer.from(await pdfRes.arrayBuffer())
  console.log(`[analizar] Archivo descargado, tamaño: ${buffer.length} bytes`)

  // ── 2. Parsear archivo y matchear contra estudiantes en DB ───────────────
  const contentType = pdfRes.headers.get('content-type') ?? ''
  const esExcel = simulacro.tipoArchivo === 'excel'
    || /\.(xlsx|xls)$/i.test(simulacro.archivoUrl)
    || contentType.includes('spreadsheetml')
    || contentType.includes('ms-excel')
  let resultadosBrutos
  let modoReal = esExcel ? 'Excel' : 'PDF'
  try {
    if (esExcel) {
      resultadosBrutos = extraerResultadosDeExcel(buffer)
    } else {
      try {
        resultadosBrutos = await extraerResultadosDePDF(buffer)
      } catch (pdfErr: any) {
        // Si pdf2json falla con error de cabecera, el archivo es probablemente Excel
        if (/XRef|Invalid|stream header/i.test(String(pdfErr))) {
          console.log('[analizar] PDF falló con error de cabecera, reintentando como Excel...')
          resultadosBrutos = extraerResultadosDeExcel(buffer)
          modoReal = 'Excel (auto-detectado)'
          // Actualizar tipoArchivo en DB para futuros análisis
          await prisma.simulacro.update({ where: { id }, data: { tipoArchivo: 'excel' } })
        } else {
          throw pdfErr
        }
      }
    }
    console.log(`[analizar] Resultados extraídos (${modoReal}): ${resultadosBrutos.length}`)
  } catch (err) {
    console.error('[analizar] Error parseando archivo:', err)
    return res.status(500).json({ error: 'Error al procesar el archivo', detalle: String(err) })
  }

  if (resultadosBrutos.length === 0) {
    return res.status(422).json({
      error: 'No se encontraron resultados en el PDF. Verifica que el formato sea compatible.',
      ayuda: 'El PDF debe contener bloques con "Nombre:", puntajes por área, o una tabla con encabezados de área.',
    })
  }

  const resultados = await matchearConDB(resultadosBrutos)

  // ── 3. Guardar en DB (upsert — re-analizar no duplica) ───────────────────
  let guardados = 0
  let sinMatch  = 0

  for (const r of resultados) {
    if (!r.estudianteId) { sinMatch++; continue }

    await prisma.simulacroEstudiante.upsert({
      where: { estudianteId_simulacroId: { estudianteId: r.estudianteId, simulacroId: id } },
      create: {
        estudianteId:       r.estudianteId,
        simulacroId:        id,
        puntajeTotal:       r.puntajeTotal,
        porcentajeAciertos: r.porcentajeAciertos,
        areasDebiles:       r.areasDebiles,
        rendimiento:        r.estado as any,
        requiereIntensivo:  r.requiereIntensivo,
      },
      update: {
        puntajeTotal:       r.puntajeTotal,
        porcentajeAciertos: r.porcentajeAciertos,
        areasDebiles:       r.areasDebiles,
        rendimiento:        r.estado as any,
        requiereIntensivo:  r.requiereIntensivo,
        fechaAnalisis:      new Date(),
      },
    })
    guardados++
  }

  // ── 4. Marcar simulacro como procesado ───────────────────────────────────
  await prisma.simulacro.update({ where: { id }, data: { procesado: true } })

  return ApiResponse.success(res, {
    totalEncontrados:  resultados.length,
    guardados,
    sinMatch,
    sinMatchNombres:   resultados.filter(r => !r.estudianteId).map(r => r.nombre),
  })
}

export async function resultados(req: Request, res: Response) {
  const resultados = await prisma.simulacroEstudiante.findMany({
    where: { simulacroId: req.params.id },
    include: { estudiante: true },
    orderBy: { puntajeTotal: 'desc' },
  })
  return ApiResponse.success(res, resultados)
}

export async function eliminar(req: Request, res: Response) {
  const { id } = req.params
  const simulacro = await prisma.simulacro.findUnique({ where: { id } })
  if (!simulacro) throw new NotFoundError('Simulacro no encontrado')

  // Eliminar resultados de estudiantes y luego el simulacro
  await prisma.simulacroEstudiante.deleteMany({ where: { simulacroId: id } })
  await prisma.simulacro.delete({ where: { id } })

  return ApiResponse.success(res, { message: 'Simulacro eliminado correctamente' })
}
