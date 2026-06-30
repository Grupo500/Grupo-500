import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import '../../examen.css'

export default async function PreviewExamenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sesion?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') redirect('/no-autorizado')

  const examId = parseInt(id)
  if (isNaN(examId)) redirect('/examenes/admin')

  const sesionActual = parseInt(sp.sesion ?? '1') === 2 ? 2 : 1

  const [examen, preguntas] = await Promise.all([
    prisma.examen.findUnique({ where: { id: examId } }),
    prisma.preguntaExamen.findMany({
      where: { examenId: examId, sesion: sesionActual },
      orderBy: { numero: 'asc' },
    }),
  ])

  if (!examen) redirect('/examenes/admin')

  return (
    <div className="examen-sim">
      {/* Banner de preview */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#f59e0b', color: '#78350f',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 18px', fontSize: '.82rem', fontWeight: 700,
        boxShadow: '0 2px 8px rgba(0,0,0,.12)',
      }}>
        <span>👁 VISTA PREVIA — Así lo ve el estudiante</span>
        <Link
          href={`/examenes/admin`}
          style={{ color: '#78350f', textDecoration: 'underline', fontSize: '.8rem' }}
        >
          ← Volver al panel
        </Link>
      </div>

      {/* Header del examen (réplica exacta) */}
      <header className="encabezado">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/logo.png" alt="Grupo 500" width={40} height={40} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              Grupo <span style={{ color: 'var(--azul)' }}>500</span>
            </div>
            <div className="nota">{examen.titulo}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'var(--azul)', color: '#fff', borderRadius: 'var(--radio)',
            padding: '6px 14px', fontWeight: 700, fontSize: '.9rem',
          }}>
            {sesionActual === 1 ? 'Primera sesión' : 'Segunda sesión'}
          </div>
          {/* Toggle sesión */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2].map(s => (
              <Link
                key={s}
                href={`/examenes/admin/preview/${examId}?sesion=${s}`}
                style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: '.8rem', fontWeight: 600,
                  background: sesionActual === s ? 'var(--azul)' : 'var(--linea)',
                  color: sesionActual === s ? '#fff' : 'var(--gris)',
                  textDecoration: 'none',
                }}
              >
                S{s}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="contenedor" style={{ paddingBottom: 80 }}>
        {preguntas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gris)' }}>
            No hay preguntas cargadas para esta sesión.
          </div>
        ) : (
          <div className="preguntas-lista">
            {preguntas.map((p, idx) => (
              <div key={String(p.id)} className="pregunta-bloque">
                {/* Contexto */}
                {p.contexto && (
                  <div className="contexto">
                    {p.contexto.split('\n\n').filter(Boolean).map((par, i) => (
                      <p key={i}>{par.trim()}</p>
                    ))}
                  </div>
                )}

                {/* Imagen */}
                {p.imagenUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imagenUrl}
                    alt={`Pregunta ${p.numero}`}
                    style={{ maxWidth: '100%', maxHeight: 340, borderRadius: 10, marginBottom: 10, border: '1px solid var(--linea)' }}
                  />
                )}

                {/* Número + enunciado */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <span style={{
                    flexShrink: 0, width: 28, height: 28, background: 'var(--azul)', color: '#fff',
                    borderRadius: 7, display: 'grid', placeItems: 'center',
                    fontWeight: 800, fontSize: '.85rem',
                  }}>{p.numero ?? idx + 1}</span>
                  <div style={{ paddingTop: 4 }}>
                    {p.enunciado.split('\n\n').filter(Boolean).map((par, i) => (
                      <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0', lineHeight: 1.6 }}>{par.trim()}</p>
                    ))}
                  </div>
                </div>

                {/* Opciones (no interactivas) */}
                {p.opcionA && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 38 }}>
                    {([
                      ['A', p.opcionA], ['B', p.opcionB], ['C', p.opcionC], ['D', p.opcionD],
                    ] as const).map(([letra, txt]) => {
                      if (!txt) return null
                      const esCor = letra === p.correcta
                      return (
                        <div key={letra} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '9px 13px', borderRadius: 10,
                          background: esCor ? '#e7f6ec' : 'var(--fondo)',
                          border: `1.5px solid ${esCor ? 'var(--ok)' : 'var(--linea)'}`,
                        }}>
                          <span style={{
                            flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                            display: 'grid', placeItems: 'center',
                            fontWeight: 800, fontSize: '.78rem',
                            background: esCor ? 'var(--ok)' : 'var(--azul-borde)',
                            color: esCor ? '#fff' : 'var(--azul)',
                          }}>{letra}</span>
                          <span style={{ fontSize: '.92rem', paddingTop: 2, flex: 1 }}>{txt}</span>
                          {esCor && (
                            <span style={{ fontSize: '.75rem', color: 'var(--ok)', fontWeight: 700, flexShrink: 0, paddingTop: 2 }}>
                              ✓ Correcta
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Explicación (si existe) */}
                {p.explicacion && (
                  <div style={{
                    marginLeft: 38, marginTop: 10, background: 'var(--azul-claro)',
                    borderRadius: 10, padding: '9px 13px', fontSize: '.85rem',
                    color: 'var(--azul-osc)', borderLeft: '3px solid var(--azul)',
                  }}>
                    <strong>Explicación: </strong>{p.explicacion}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
