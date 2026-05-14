/**
 * Elimina un usuario de la DB y de Clerk.
 * Uso: tsx prisma/delete-user.ts <email>
 */
import { PrismaClient } from '@prisma/client'
import { createClerkClient } from '@clerk/backend'

const prisma = new PrismaClient()
const clerk  = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

async function main() {
  const email = process.argv[2]
  if (!email) { console.error('Uso: tsx prisma/delete-user.ts <email>'); process.exit(1) }

  // 1. Eliminar de DB
  const user = await prisma.user.findFirst({ where: { email } })
  if (user) {
    await prisma.user.delete({ where: { id: user.id } })
    console.log(`✅ Eliminado de DB: ${email}`)

    // 2. Eliminar de Clerk
    try {
      await clerk.users.deleteUser(user.clerkId)
      console.log(`✅ Eliminado de Clerk: ${user.clerkId}`)
    } catch (e) {
      console.warn(`⚠️  No se pudo eliminar de Clerk (puede que ya no exista): ${e}`)
    }
  } else {
    console.log(`⚠️  Usuario no encontrado en DB: ${email}`)
    // Intentar eliminar de Clerk por email
    const clerkUsers = await clerk.users.getUserList({ emailAddress: [email] })
    if (clerkUsers.data.length) {
      await clerk.users.deleteUser(clerkUsers.data[0].id)
      console.log(`✅ Eliminado de Clerk: ${clerkUsers.data[0].id}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
