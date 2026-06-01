import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const formularios = await prisma.formulario.findMany()

  for (const form of formularios) {
    const campos = form.campos as any[]
    const parentesco = campos.find((c: any) => c.id === 'parentesco' || c.id === 'parentesco_acudiente')

    if (!parentesco) {
      console.log(`⏭️  "${form.nombre}" no tiene parentesco_acudiente`)
      continue
    }

    if (!parentesco.opciones) {
      console.log(`⏭️  "${form.nombre}" parentesco sin opciones`)
      continue
    }

    // Reordenar: Papá primero, luego Mamá, luego el resto
    const ordenDeseado = ['Papá', 'Mamá', 'Otro', 'Tutor/a', 'Abuelo/a', 'Tío/a', 'Hermano/a']
    const opcionesActuales: string[] = parentesco.opciones

    const ordenadas = [
      ...ordenDeseado.filter(o => opcionesActuales.includes(o)),
      ...opcionesActuales.filter(o => !ordenDeseado.includes(o)),
    ]

    parentesco.opciones = ordenadas

    await prisma.formulario.update({
      where: { id: form.id },
      data: { campos: campos as any },
    })

    console.log(`✅ "${form.nombre}" — parentesco reordenado: ${ordenadas.join(', ')}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
