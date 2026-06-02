import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const formularios = await prisma.formulario.findMany()
  for (const form of formularios) {
    const campos = form.campos as any[]
    const idxComp = campos.findIndex((c: any) => c.id === 'comprobante')
    const idxDoc  = campos.findIndex((c: any) => c.id === 'doc_identidad')
    if (idxComp === -1 || idxDoc === -1) { console.log(`⏭️  "${form.nombre}" no tiene ambos campos`); continue }
    // Intercambiar
    ;[campos[idxComp], campos[idxDoc]] = [campos[idxDoc], campos[idxComp]]
    await prisma.formulario.update({ where: { id: form.id }, data: { campos: campos as any } })
    console.log(`✅ "${form.nombre}" — comprobante y doc_identidad intercambiados`)
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
