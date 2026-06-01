import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const formularios = await prisma.formulario.findMany()

  for (const form of formularios) {
    const campos = form.campos as any[]

    // Mostrar orden actual
    console.log(`\n📋 "${form.nombre}"`)
    campos.forEach((c, i) => console.log(`  ${i}. [${c.id}] ${c.label}`))

    // Buscar los campos relevantes
    const idxNumDoc  = campos.findIndex((c: any) => c.id === 'num_doc')
    const idxDocFoto = campos.findIndex((c: any) => c.id === 'doc_identidad' || c.tipo === 'archivo')

    if (idxNumDoc === -1) { console.log('  ⏭️  No se encontró num_doc'); continue }
    if (idxDocFoto === -1) { console.log('  ⏭️  No se encontró doc_identidad'); continue }

    if (idxDocFoto === idxNumDoc + 1) {
      console.log('  ✅  Ya está en la posición correcta')
      continue
    }

    // Mover doc_identidad justo después de num_doc
    const campoDoc = campos.splice(idxDocFoto, 1)[0]
    const newIdx   = campos.findIndex((c: any) => c.id === 'num_doc') + 1
    campos.splice(newIdx, 0, campoDoc)

    await prisma.formulario.update({
      where: { id: form.id },
      data: { campos: campos as any },
    })

    console.log(`  ✅  doc_identidad movido a posición ${newIdx} (después de num_doc)`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
