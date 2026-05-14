/**
 * Crea registros Asesor para todos los Users que no tienen uno.
 * Uso: tsx prisma/sync-asesores.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const usuarios = await prisma.user.findMany({
    where: { asesor: null },
  })

  if (!usuarios.length) {
    console.log('✅ Todos los usuarios ya tienen perfil de asesor.')
    return
  }

  console.log(`🔍 Encontrados ${usuarios.length} usuarios sin perfil de asesor...`)

  for (const user of usuarios) {
    const nombre = user.email.split('@')[0]
    await prisma.asesor.create({
      data: {
        userId:   user.id,
        nombre:   nombre.charAt(0).toUpperCase() + nombre.slice(1),
        email:    user.email,
        telefono: '000-000-0000',
      },
    })
    console.log(`✅ Asesor creado para: ${user.email}`)
  }

  console.log('\n🎉 Sincronización completa.')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
