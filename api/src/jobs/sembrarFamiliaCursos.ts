// Siembra el campo `familia` de los cursos a partir de su nombre.
// Solo rellena los que no lo tienen: una vez editado a mano, manda el campo.
//
//   npx tsx src/jobs/sembrarFamiliaCursos.ts

import { prisma } from '../config/prisma'
import { familiaDesdeNombre } from '../utils/familiaCurso'

export async function sembrarFamiliaCursos(sobrescribir = false) {
  const cursos = await prisma.curso.findMany({ select: { id: true, nombre: true, familia: true } })
  const conteo: Record<string, number> = {}
  let tocados = 0

  for (const c of cursos) {
    const f = familiaDesdeNombre(c.nombre)
    conteo[f] = (conteo[f] ?? 0) + 1
    if (!sobrescribir && c.familia) continue
    if (c.familia === f) continue
    await prisma.curso.update({ where: { id: c.id }, data: { familia: f } })
    tocados++
  }

  console.log(`cursos revisados: ${cursos.length} | actualizados: ${tocados}`)
  Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, n]) => console.log('  ' + f.padEnd(12) + n))

  return { total: cursos.length, tocados }
}

if (require.main === module) {
  sembrarFamiliaCursos(process.argv.includes('--sobrescribir'))
    .then(() => process.exit(0))
    .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
}
