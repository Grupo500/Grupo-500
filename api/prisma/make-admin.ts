/**
 * Script para promover un usuario a ADMIN por email.
 * Uso: tsx prisma/make-admin.ts <email>
 *
 * Si el usuario no existe en DB (aún no hizo login a la API),
 * lo busca en Clerk por email y lo crea automáticamente como ADMIN.
 */
import { PrismaClient } from '@prisma/client'
import { createClerkClient } from '@clerk/backend'

const prisma = new PrismaClient()
const clerk  = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('❌ Uso: tsx prisma/make-admin.ts <email>')
    process.exit(1)
  }

  console.log(`🔍 Buscando usuario: ${email}`)

  // 1. Buscar en DB por email
  let user = await prisma.user.findFirst({ where: { email } })

  if (user) {
    // Ya existe → solo cambiar rol
    user = await prisma.user.update({
      where: { id: user.id },
      data:  { role: 'ADMIN' },
    })
    console.log(`✅ Rol actualizado a ADMIN: ${user.email} (id: ${user.id})`)
  } else {
    // No existe en DB → buscar en Clerk y crear
    console.log('⚠️  No encontrado en DB. Buscando en Clerk...')

    const clerkUsers = await clerk.users.getUserList({ emailAddress: [email] })
    if (!clerkUsers.data.length) {
      console.error(`❌ No existe ningún usuario con email "${email}" en Clerk.`)
      process.exit(1)
    }

    const clerkUser = clerkUsers.data[0]
    user = await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email:   clerkUser.emailAddresses[0]?.emailAddress ?? email,
        role:    'ADMIN',
      },
    })
    console.log(`✅ Usuario creado en DB como ADMIN: ${user.email} (clerkId: ${clerkUser.id})`)
  }

  // 2. Crear registro Asesor si no tiene (ADMIN también puede ser asesor)
  const nombre = email.split('@')[0]
  const asesorExiste = await prisma.asesor.findUnique({ where: { userId: user.id } })
  if (!asesorExiste) {
    await prisma.asesor.create({
      data: {
        userId:   user.id,
        nombre:   nombre.charAt(0).toUpperCase() + nombre.slice(1),
        email:    user.email,
        telefono: '0000000000',
      },
    })
    console.log(`✅ Perfil de asesor creado para ${user.email}`)
  }

  console.log('\n🎉 Listo. El usuario ya puede acceder como ADMIN.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
