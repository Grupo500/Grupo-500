import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Deja únicamente "Addi" como opción del campo método de pago en todos los formularios.
async function main() {
  const formularios = await prisma.formulario.findMany()

  for (const form of formularios) {
    const campos = form.campos as any[]
    const campo = campos.find((c: any) => c.id === 'metodo_pago')

    if (!campo) {
      console.log(`⏭️  "${form.nombre}" no tiene campo metodo_pago`)
      continue
    }

    const actuales = Array.isArray(campo.opciones) ? campo.opciones : []
    if (actuales.length === 1 && actuales[0] === 'Addi') {
      console.log(`⏭️  "${form.nombre}" ya tiene solo Addi`)
      continue
    }

    campo.opciones = ['Addi']

    await prisma.formulario.update({
      where: { id: form.id },
      data: { campos },
    })

    console.log(`✅ "${form.nombre}" — método de pago dejado en: Addi (antes: ${actuales.join(', ') || '—'})`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
