// Sincronización de inversión publicitaria desde Google Ads.
//
// Escribe una fila por campaña y día en InversionPublicitaria, de donde el
// módulo de Finanzas calcula CAC y MER. No consulta la API en cada carga del
// dashboard: Google tiene tope de operaciones diarias y las cifras del día en
// curso se siguen ajustando durante horas, así que se guarda y se lee local.

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { gastoDiarioPorCampania, googleAdsConfigurado } from '../services/googleAds'

// Google reajusta el gasto de días pasados (clics inválidos, conversiones que
// llegan tarde), así que cada corrida reescribe la última semana en vez de
// traer solo lo de hoy.
const DIAS_VENTANA = 7

export async function sincronizarGoogleAds(): Promise<void> {
  if (!googleAdsConfigurado()) {
    logger.warn('[Google Ads] Credenciales incompletas — sincronización omitida')
    return
  }

  try {
    const hasta = new Date()
    const desde = new Date(hasta)
    desde.setDate(desde.getDate() - (DIAS_VENTANA - 1))

    const filas = await gastoDiarioPorCampania(desde, hasta)

    let creadas = 0
    let actualizadas = 0

    for (const f of filas) {
      // La fila cubre un solo día: desde y hasta son la misma fecha, a
      // medianoche de Colombia (la TZ del proceso ya es America/Bogota).
      const dia = new Date(`${f.fecha}T00:00:00`)

      const previa = await prisma.inversionPublicitaria.findUnique({
        where: { plataforma_campaniaId_desde: { plataforma: 'GOOGLE', campaniaId: f.campaniaId, desde: dia } },
        select: { id: true },
      })

      await prisma.inversionPublicitaria.upsert({
        where: { plataforma_campaniaId_desde: { plataforma: 'GOOGLE', campaniaId: f.campaniaId, desde: dia } },
        create: {
          plataforma: 'GOOGLE',
          campaniaId: f.campaniaId,
          campania: f.campania,
          desde: dia,
          hasta: dia,
          gastoCOP: f.gastoCOP,
          impresiones: f.impresiones,
          clics: f.clics,
          conversiones: f.conversiones,
          estado: f.estado,
          fuente: 'API',
        },
        update: {
          // El nombre se refresca porque las campañas se renombran; el id no.
          campania: f.campania,
          gastoCOP: f.gastoCOP,
          impresiones: f.impresiones,
          clics: f.clics,
          conversiones: f.conversiones,
          estado: f.estado,
        },
      })

      previa ? actualizadas++ : creadas++
    }

    logger.info(`[Google Ads] Sincronización lista: ${creadas} nuevas, ${actualizadas} actualizadas`)
  } catch (e) {
    // Un fallo de Google no debe tumbar el servidor: se registra y se reintenta
    // en la siguiente corrida.
    logger.error(`[Google Ads] Falló la sincronización: ${(e as Error).message}`)
  }
}
