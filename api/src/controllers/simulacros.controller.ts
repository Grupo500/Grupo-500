import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { extraerResultadosDePDF, matchearConDB } from '../services/simulacro.service'
import fetch from 'node-fetch'

export async function listar(_req: Request, res: Response) {
  const simulacros = await prisma.simulacro.findMany({
    include: {
      estudiantes: {
        include: { estudiante: { select: { nombre: true } } },
        orderBy: { puntajeTotal: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return ApiResponse.success(res, simulacros)
}

export async function subir(req: Request, res: Response) {
  const { nombre, archivoUrl } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })

  const simulacro = await prisma.simulacro.create({
    data: { nombre, archivoUrl: archivoUrl ?? '' },
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
  const pdfRes = await fetch(simulacro.archivoUrl)
  if (!pdfRes.ok) {
    return res.status(502).json({ error: 'No se pudo descargar el PDF desde Cloudinary' })
  }
  const buffer = Buffer.from(await pdfRes.arrayBuffer())

  // ── 2. Parsear PDF y matchear contra estudiantes en DB ───────────────────
  const resultadosBrutos = await extraerResultadosDePDF(buffer)
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
        estado:             r.estado,
        requiereIntensivo:  r.requiereIntensivo,
      },
      update: {
        puntajeTotal:       r.puntajeTotal,
        porcentajeAciertos: r.porcentajeAciertos,
        areasDebiles:       r.areasDebiles,
        estado:             r.estado,
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
