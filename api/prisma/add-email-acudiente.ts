import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const formularios = await prisma.formulario.findMany()

  for (const form of formularios) {
    const campos = form.campos as any[]

    // Verificar si ya existe el campo
    if (campos.some((c: any) => c.id === 'email_acudiente')) {
      console.log(`⏭️  "${form.nombre}" ya tiene email_acudiente`)
      continue
    }

    // Buscar el índice del campo cel_acudiente para insertar justo antes
    const idxCel = campos.findIndex((c: any) => c.id === 'cel_acudiente')
    const insertAt = idxCel !== -1 ? idxCel : campos.length

    const nuevoCampo = {
      id: 'email_acudiente',
      tipo: 'email',
      label: 'Correo electrónico del acudiente',
      placeholder: 'correo@ejemplo.com',
      requerido: false,
    }

    campos.splice(insertAt, 0, nuevoCampo)

    await prisma.formulario.update({
      where: { id: form.id },
      data: { campos },
    })

    console.log(`✅ "${form.nombre}" — campo email_acudiente agregado en posición ${insertAt}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
