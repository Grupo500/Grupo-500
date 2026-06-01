import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const cursos = await prisma.curso.findMany()

  for (const c of cursos) {
    const esCombo = c.nombre.toLowerCase().includes('combo') || c.nombre.includes('+')
    const tipoDeseado = esCombo ? 'COMBO' : 'INDIVIDUAL'

    if (c.tipoCurso === tipoDeseado) {
      console.log(`⏭️  "${c.nombre}" ya es ${tipoDeseado}`)
      continue
    }

    await prisma.curso.update({
      where: { id: c.id },
      data: { tipoCurso: tipoDeseado },
    })

    console.log(`✅ "${c.nombre}" → ${tipoDeseado}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
