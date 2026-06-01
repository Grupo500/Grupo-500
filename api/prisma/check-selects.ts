import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const f = await prisma.formulario.findFirst()
  const campos = f?.campos as any[]
  const sel = campos?.filter((c: any) => c.tipo === 'select')
  console.log(JSON.stringify(sel, null, 2))
  await prisma.$disconnect()
}
main().catch(console.error)
