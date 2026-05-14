import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) { console.error('Uso: tsx prisma/delete-user.ts <email>'); process.exit(1) }

  const deleted = await prisma.user.delete({ where: { email } })
  console.log(`✅ Usuario eliminado: ${deleted.email}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
