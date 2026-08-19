import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Search } from 'lucide-react'
import { claveNombre, cop, iniciales, slugNombre } from '@/lib/contabilidadMarketing'

export const dynamic = 'force-dynamic'

// Índice de personas (solo contabilidad). Quien trabaja en varias áreas tiene
// una fila de `contab_personas` por cada una y aquí se unifica bajo un solo
// nombre, con el desglose de cuánto lleva en cada departamento. En el detalle
// de cada departamento sigue apareciendo por separado, que es como el equipo
// necesita verlo para aprobar y pagar.
export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string }>
}) {
  const session = await auth()
  if (((session?.user as any)?.role ?? '') !== 'ADMIN') redirect('/marketing/contabilidad')

  const { buscar } = await searchParams
  const termino = (buscar ?? '').trim()

  const [personas, registros] = await Promise.all([
    prisma.contabPersona.findMany({ include: { dept: true } }),
    prisma.contabRegistro.findMany({ select: { personaId: true, valor: true, quincena: true } }),
  ])

  const porFila = new Map<string, { total: number; n: number; quincenas: Set<string> }>()
  for (const r of registros) {
    const a = porFila.get(r.personaId) ?? { total: 0, n: 0, quincenas: new Set<string>() }
    a.total += r.valor
    a.n += 1
    a.quincenas.add(r.quincena)
    porFila.set(r.personaId, a)
  }

  type Area = { id: string; nombre: string; gradiente: string; icono: string; total: number }
  type Ficha = {
    nombre: string; slug: string; fotoUrl: string | null
    total: number; n: number; quincenas: Set<string>; areas: Area[]
  }

  const fichas = new Map<string, Ficha>()
  for (const p of personas) {
    const a = porFila.get(p.id) ?? { total: 0, n: 0, quincenas: new Set<string>() }
    const clave = claveNombre(p.nombre)
    const f = fichas.get(clave) ?? {
      nombre: p.nombre, slug: slugNombre(p.nombre), fotoUrl: null,
      total: 0, n: 0, quincenas: new Set<string>(), areas: [],
    }
    f.total += a.total
    f.n += a.n
    for (const q of a.quincenas) f.quincenas.add(q)
    f.fotoUrl = f.fotoUrl ?? p.fotoUrl
    f.areas.push({ id: p.deptId, nombre: p.dept.nombre, gradiente: p.dept.gradiente, icono: p.dept.icono, total: a.total })
    fichas.set(clave, f)
  }

  const claveTermino = claveNombre(termino)
  const lista = [...fichas.entries()]
    .filter(([clave]) => !claveTermino || clave.includes(claveTermino))
    .map(([, f]) => f)
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/marketing/contabilidad/panel"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Panel contable
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-on-surface">Buscar persona</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Historial completo de cada persona, con todas sus áreas sumadas bajo un solo nombre.
        </p>
      </div>

      <form className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            name="buscar"
            defaultValue={termino}
            placeholder="Nombre de la persona"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant"
          />
        </div>
        <button type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity">
          Buscar
        </button>
        {termino && (
          <Link href="/marketing/contabilidad/personas"
            className="px-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-on-surface">
            Limpiar
          </Link>
        )}
      </form>

      <p className="text-xs text-on-surface-variant">
        {lista.length === 0
          ? 'Ninguna persona coincide con la búsqueda.'
          : `${lista.length} ${lista.length === 1 ? 'persona' : 'personas'}${termino ? ' encontradas' : ' en el índice'}.`}
      </p>

      <div className="space-y-2.5">
        {lista.map(f => (
          <Link key={f.slug} href={`/marketing/contabilidad/personas/${f.slug}`}
            className="bg-surface-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
            {f.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.fotoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: `linear-gradient(150deg, ${f.areas[0]?.gradiente ?? '#1257C4,#8FD0FF'})` }}>
                {iniciales(f.nombre)}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{f.nombre}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {f.areas.map(a => (
                  <span key={a.id}
                    className="text-[11px] px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ background: `linear-gradient(150deg, ${a.gradiente})` }}>
                    {a.nombre}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <b className="text-sm text-on-surface tabular-nums">{cop(f.total)}</b>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {f.n} {f.n === 1 ? 'actividad' : 'actividades'} · {f.quincenas.size}{' '}
                {f.quincenas.size === 1 ? 'quincena' : 'quincenas'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
