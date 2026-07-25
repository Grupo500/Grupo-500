import { prisma } from '@/lib/prisma'
import {
  CUPOS_ASCENSO, CUPOS_DESCENSO, LIGA_MAX, SEMANAS_INACTIVAS_PARA_DESCENDER,
  TAM_GRUPO, diasRestantesSemana, semanaDe,
} from '@/lib/britoLigas'

export interface MiembroLiga {
  estudianteId: string
  nombre: string
  xpSemana: number
  posicion: number
}

export interface EstadoLiga {
  liga: number
  miPosicion: number
  diasRestantes: number
  miembros: MiembroLiga[]
}

/** Grupo de la liga/semana con cupo libre; si no hay, crea uno nuevo. */
async function grupoConCupo(liga: number, semana: string) {
  const grupos = await prisma.britoGrupoLiga.findMany({
    where: { liga, semana },
    include: { _count: { select: { miembros: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const conCupo = grupos.find(g => g._count.miembros < TAM_GRUPO)
  if (conCupo) return conCupo
  return prisma.britoGrupoLiga.create({ data: { liga, semana } })
}

/**
 * Garantiza que el estudiante tenga membresía en la semana en curso, cerrando
 * antes la semana anterior si quedó pendiente.
 *
 * El cierre es perezoso: cada estudiante liquida su propia membresía al leerla,
 * a partir de los xpSemana ya persistidos de todo su grupo. Es determinista, así
 * que no hace falta un proceso central que cierre la semana para todos.
 */
export async function asegurarLiga(estudianteId: string) {
  const perfil = await prisma.britoPerfil.findUnique({ where: { estudianteId } })
  if (!perfil) return null

  const semana = semanaDe()

  if (perfil.ligaSemana === semana) {
    const vigente = await prisma.britoMiembroLiga.findFirst({
      where: { estudianteId, grupo: { semana } },
    })
    if (vigente) return vigente
  }

  let liga = perfil.liga
  let semanasInactivas = perfil.semanasInactivas

  if (perfil.ligaSemana && perfil.ligaSemana !== semana) {
    const anterior = await prisma.britoMiembroLiga.findFirst({
      where: { estudianteId, grupo: { semana: perfil.ligaSemana } },
      include: { grupo: { include: { miembros: true } } },
    })

    if (anterior) {
      const orden = [...anterior.grupo.miembros].sort(
        (a, b) => b.xpSemana - a.xpSemana || a.id.localeCompare(b.id)
      )
      const posicion = orden.findIndex(m => m.id === anterior.id) + 1
      const total = orden.length
      // En grupos pequeños no hay zona de descenso: no tiene sentido bajar a
      // alguien por quedar de último entre tres personas.
      const hayZonaDescenso = total > CUPOS_ASCENSO + CUPOS_DESCENSO

      let resultado: 'ASCENSO' | 'DESCENSO' | 'PERMANECE' = 'PERMANECE'
      if (anterior.xpSemana === 0) {
        semanasInactivas += 1
        if (semanasInactivas >= SEMANAS_INACTIVAS_PARA_DESCENDER) {
          resultado = 'DESCENSO'
          semanasInactivas = 0
        }
      } else {
        semanasInactivas = 0
        if (posicion <= CUPOS_ASCENSO) resultado = 'ASCENSO'
        else if (hayZonaDescenso && posicion > total - CUPOS_DESCENSO) resultado = 'DESCENSO'
      }

      if (resultado === 'ASCENSO') liga = Math.min(liga + 1, LIGA_MAX)
      if (resultado === 'DESCENSO') liga = Math.max(liga - 1, 0)

      await prisma.britoMiembroLiga.update({ where: { id: anterior.id }, data: { resultado } })
    }
  }

  const grupo = await grupoConCupo(liga, semana)
  const miembro = await prisma.britoMiembroLiga.upsert({
    where: { grupoId_estudianteId: { grupoId: grupo.id, estudianteId } },
    create: { grupoId: grupo.id, estudianteId },
    update: {},
  })

  await prisma.britoPerfil.update({
    where: { estudianteId },
    data: { liga, ligaSemana: semana, semanasInactivas },
  })

  return miembro
}

/** Estado completo de la liga del estudiante: su grupo ordenado y su posición. */
export async function obtenerEstadoLiga(estudianteId: string): Promise<EstadoLiga | null> {
  const miembro = await asegurarLiga(estudianteId)
  if (!miembro) return null

  const grupo = await prisma.britoGrupoLiga.findUnique({
    where: { id: miembro.grupoId },
    include: { miembros: true },
  })
  if (!grupo) return null

  const estudiantes = await prisma.estudianteExamen.findMany({
    where: { id: { in: grupo.miembros.map(m => m.estudianteId) } },
    select: { id: true, nombre: true },
  })
  const nombreDe = new Map(estudiantes.map(e => [e.id, e.nombre]))

  const miembros = [...grupo.miembros]
    .sort((a, b) => b.xpSemana - a.xpSemana || a.id.localeCompare(b.id))
    .map((m, i) => ({
      estudianteId: m.estudianteId,
      nombre: nombreDe.get(m.estudianteId) ?? 'Estudiante',
      xpSemana: m.xpSemana,
      posicion: i + 1,
    }))

  return {
    liga: grupo.liga,
    miPosicion: miembros.find(m => m.estudianteId === estudianteId)?.posicion ?? 0,
    diasRestantes: diasRestantesSemana(),
    miembros,
  }
}
