import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: 'pregrupo500@gmail.com' },
    select: { id: true, email: true, nombre: true, role: true, hashedPassword: true, createdAt: true },
  })

  if (!u) { console.log('❌ Usuario no encontrado'); return }

  console.log('Usuario encontrado:')
  console.log('  ID:            ', u.id)
  console.log('  Email:         ', u.email)
  console.log('  Nombre:        ', u.nombre)
  console.log('  Rol:           ', u.role)
  console.log('  hashedPassword:', u.hashedPassword ? '✅ SET' : '❌ NULL')
  console.log('  createdAt:     ', u.createdAt)

  if (u.hashedPassword) {
    const ok = await bcrypt.compare('Grupo500.', u.hashedPassword)
    console.log('  Password match:', ok ? '✅ Correcto' : '❌ No coincide')
  } else {
    // Setear la contraseña si está null
    console.log('\n  ⚠️  Sin contraseña — actualizando...')
    const hash = await bcrypt.hash('Grupo500.', 12)
    await prisma.user.update({ where: { id: u.id }, data: { hashedPassword: hash, nombre: 'Grupo 500', role: 'ADMIN' } })
    console.log('  ✅ Contraseña y datos actualizados')
  }
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
