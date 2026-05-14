import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('Usuarios en DB:', JSON.stringify(users, null, 2))
  await prisma.$disconnect()
}
main()
