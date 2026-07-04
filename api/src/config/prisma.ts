import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// `beforeExit` con un handler async puede re-dispararse en bucle: cada vez
// que el disconnect (async) termina, el event loop vuelve a quedar vacío y
// Node emite `beforeExit` de nuevo. La bandera evita desconectar más de una vez.
let desconectando = false
process.on('beforeExit', async () => {
  if (desconectando) return
  desconectando = true
  await prisma.$disconnect()
  logger.info('Prisma desconectado correctamente')
})
