/**
 * Script para crear el primer usuario ADMIN en producción.
 * Uso: npx ts-node scripts/seed-admin.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email    = 'pregrupo500@gmail.com'
  const password = 'Grupo500.'
  const nombre   = 'Grupo 500'
  const role     = 'ADMIN' as const

  const existe = await prisma.user.findUnique({ where: { email } })
  if (existe) {
    console.log('⚠️  El usuario ya existe:', email)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      nombre,
      role,
      hashedPassword,
      // ADMIN no necesita perfil de asesor
    },
  })

  console.log('✅ Usuario ADMIN creado exitosamente')
  console.log('   ID:    ', user.id)
  console.log('   Email: ', user.email)
  console.log('   Nombre:', user.nombre)
  console.log('   Rol:   ', user.role)
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
