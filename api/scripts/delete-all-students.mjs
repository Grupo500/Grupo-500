import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Cargar .env manualmente
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const prisma = new PrismaClient()

async function main() {
  console.log('Eliminando todos los datos relacionados...')

  // Eliminar en orden para respetar FK (aunque hay cascade, mejor explícito)
  const pagos      = await prisma.pago.deleteMany({})
  const cuotas     = await prisma.cuota.deleteMany({})
  const finan      = await prisma.financiamiento.deleteMany({})
  const cursoEst   = await prisma.cursoEstudiante.deleteMany({})
  const simulacros = await prisma.simulacroEstudiante.deleteMany({})
  const certs      = await prisma.certificado.deleteMany({})
  const acudientes = await prisma.acudiente.deleteMany({})
  const fuentes    = await prisma.fuenteContacto.deleteMany({})
  const historial  = await prisma.historialEstudiante.deleteMany({})
  const estudiantes = await prisma.estudiante.deleteMany({})

  console.log(`✅ Pagos eliminados:        ${pagos.count}`)
  console.log(`✅ Cuotas eliminadas:       ${cuotas.count}`)
  console.log(`✅ Financiamientos elim.:   ${finan.count}`)
  console.log(`✅ CursoEstudiante elim.:   ${cursoEst.count}`)
  console.log(`✅ Simulacros eliminados:   ${simulacros.count}`)
  console.log(`✅ Certificados eliminados: ${certs.count}`)
  console.log(`✅ Acudientes eliminados:   ${acudientes.count}`)
  console.log(`✅ Fuentes eliminadas:      ${fuentes.count}`)
  console.log(`✅ Historial eliminado:     ${historial.count}`)
  console.log(`✅ Estudiantes eliminados:  ${estudiantes.count}`)
  console.log('\n🎉 Base de datos limpia. Lista para reimportar.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
