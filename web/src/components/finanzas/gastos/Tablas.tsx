'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Lock } from 'lucide-react'
import { cn, formatCOP } from '@/lib/utils'
import { numero } from '@/components/finanzas/comunes'
import { MESES_CORTOS, colorCategoria, type GastosAgenciaData } from '@/lib/gastosAgencia'
import { CeldaEditable, CeldaTextoEditable, InterruptorEditable } from './CeldaEditable'
import {
  guardarContabilidad, guardarNomina, guardarProduccion, guardarTarifario,
  crearPersonaNomina, ErrorGastos,
} from '@/lib/gastosAgenciaApi'

const CLAVE = ['finanzas-gastos-agencia']

/** Aviso único cuando la edición está apagada por falta de credenciales. */
export function AvisoSoloLectura({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="card p-3 border-l-2 border-l-amber-500 flex items-start gap-2.5">
      <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-[12.5px] font-medium text-on-surface">Las tablas están en solo lectura</p>
        <p className="text-[11.5px] text-on-surface-variant mt-0.5">
          Para editar desde aquí hace falta una cuenta de servicio de Google con permiso de editor
          sobre el sheet (<span className="font-mono text-[10.5px]">GOOGLE_SHEETS_SA_EMAIL</span> y{' '}
          <span className="font-mono text-[10.5px]">GOOGLE_SHEETS_SA_PRIVATE_KEY</span> en el servidor).
          Mientras tanto se sigue leyendo del sheet con normalidad.
        </p>
      </div>
    </div>
  )
}

function Encabezado({ titulo, ayuda }: { titulo: string; ayuda: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[15px] font-semibold text-on-surface">{titulo}</h3>
      <p className="text-[11.5px] text-on-surface-variant mt-0.5">{ayuda}</p>
    </div>
  )
}

// ── contabilidad mensual ────────────────────────────────────────────────

export function TablaContabilidad({ datos, anio, editable }: {
  datos: GastosAgenciaData
  anio: string
  editable: boolean
}) {
  const qc = useQueryClient()
  const hoja = datos.anios[anio]
  if (!hoja) return null

  const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE })

  return (
    <div className="card p-5">
      <Encabezado
        titulo={`Contabilidad ${anio}`}
        ayuda={editable
          ? 'Clic en cualquier cifra para editarla. Se escribe en el Google Sheet al instante; la fila de totales la calcula el sheet.'
          : 'Cifras del Google Sheet. La fila de totales la calcula el sheet.'}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-separate border-spacing-0">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-on-surface-variant">
              <th className="text-left py-1.5 pr-3 font-medium sticky left-0 bg-surface-container-lowest z-10">
                Categoría
              </th>
              {MESES_CORTOS.map(m => (
                <th key={m} className="py-1.5 px-1 font-medium text-right min-w-[86px]">{m}</th>
              ))}
              <th className="py-1.5 pl-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {hoja.categorias.map((c, i) => {
              const total = c.valores.reduce<number>((a, v) => a + (v ?? 0), 0)
              return (
                <tr key={c.clave} className="border-t border-surface-high">
                  <td className="py-1 pr-3 sticky left-0 bg-surface-container-lowest z-10">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: colorCategoria(c.clave, i) }} />
                      <span className="text-on-surface">{c.nombre}</span>
                    </span>
                  </td>
                  {c.valores.map((v, mes) => (
                    <td key={mes} className="py-0.5 px-0.5">
                      <CeldaEditable
                        valor={v}
                        editable={editable}
                        alGuardar={async nuevo => {
                          await guardarContabilidad({
                            anio, categoriaClave: c.clave, mes, valor: nuevo, valorAnterior: v,
                          })
                          refrescar()
                        }}
                      />
                    </td>
                  ))}
                  <td className="py-1 pl-3 text-right tabular-nums font-semibold text-on-surface whitespace-nowrap">
                    {formatCOP(total)}
                  </td>
                </tr>
              )
            })}

            <tr className="border-t-2 border-surface-high font-semibold">
              <td className="py-2 pr-3 sticky left-0 bg-surface-container-lowest z-10 text-on-surface">
                Total del mes
              </td>
              {hoja.totalPorMes.map((v, i) => (
                <td key={i} className="py-2 px-1.5 text-right tabular-nums text-on-surface whitespace-nowrap">
                  {v ? formatCOP(v) : <span className="opacity-35">—</span>}
                </td>
              ))}
              <td className="py-2 pl-3 text-right tabular-nums text-on-surface whitespace-nowrap">
                {formatCOP(hoja.totalAnio)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {hoja.descuadre.length > 0 && (
        <p className="text-[10.5px] text-amber-600 mt-3">
          El total del sheet no cuadra con la suma de categorías en:{' '}
          {hoja.descuadre.map(d => d.mes).join(', ')}. Los totales que ves son los del sheet.
        </p>
      )}
    </div>
  )
}

// ── nómina ──────────────────────────────────────────────────────────────

export function TablaNomina({ datos, editable }: { datos: GastosAgenciaData; editable: boolean }) {
  const qc = useQueryClient()
  const [abriendo, setAbriendo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [banco, setBanco] = useState('')
  const [monto, setMonto] = useState('')
  const [creando, setCreando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'si' | 'no'>('todos')

  const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE })
  const r = datos.nomina.resumen

  async function agregar() {
    if (nombre.trim().length < 3) { setProblema('Escribe el nombre completo'); return }
    setCreando(true)
    setProblema(null)
    try {
      const limpio = monto.replace(/[^\d]/g, '')
      await crearPersonaNomina({
        nombre: nombre.trim(),
        banco: banco.trim() || null,
        monto: limpio ? Number(limpio) : null,
      })
      setNombre(''); setBanco(''); setMonto(''); setAbriendo(false)
      refrescar()
    } catch (e) {
      setProblema(e instanceof ErrorGastos ? e.message : 'No pude agregar a la persona')
    } finally {
      setCreando(false)
    }
  }

  // El índice original importa: el servidor identifica la fila por posición y
  // nombre, así que filtrar no puede reordenar lo que se manda.
  let filas = datos.nomina.personas.map((p, indice) => ({ ...p, indice }))
  if (filtro === 'si') filas = filas.filter(p => p.pagado)
  if (filtro === 'no') filas = filas.filter(p => !p.pagado)
  if (busqueda.trim()) {
    const q = busqueda.trim().toLowerCase()
    filas = filas.filter(p => p.nombre.toLowerCase().includes(q) || (p.banco ?? '').toLowerCase().includes(q))
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Encabezado
          titulo={`Nómina · corte «${datos.nomina.corte || '—'}»`}
          ayuda={`${r.total} personas · ${r.pagados} pagadas por ${formatCOP(r.montoPagado)} · ${r.pendientes} pendientes`}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar persona o banco"
            className="px-2.5 py-1.5 rounded-lg bg-surface-low border border-surface-high text-[12.5px] text-on-surface w-[190px]"
          />
          <div className="inline-flex rounded-lg bg-surface-low p-0.5">
            {([['todos', 'Todos'], ['si', 'Pagados'], ['no', 'Pendientes']] as const).map(([k, et]) => (
              <button
                key={k} onClick={() => setFiltro(k)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[12px] font-medium cursor-pointer transition-colors',
                  filtro === k ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {et}
              </button>
            ))}
          </div>
          {editable && (
            <button
              onClick={() => setAbriendo(v => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-[12.5px] font-medium cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          )}
        </div>
      </div>

      {abriendo && editable && (
        <div className="rounded-xl bg-surface-low p-3 mb-3 grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
          {([
            ['Nombre completo', nombre, setNombre, 'text'],
            ['Banco', banco, setBanco, 'text'],
            ['Monto a pagar', monto, setMonto, 'text'],
          ] as const).map(([et, val, set, tipo]) => (
            <label key={et} className="block">
              <span className="block text-[10.5px] font-medium text-on-surface-variant mb-1">{et}</span>
              <input
                type={tipo} value={val} onChange={e => set(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-high text-[12.5px] text-on-surface"
              />
            </label>
          ))}
          <button
            onClick={agregar} disabled={creando}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-[12.5px] font-medium cursor-pointer disabled:opacity-60"
          >
            {creando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar en el sheet
          </button>
          <p className="sm:col-span-4 text-[10.5px] text-on-surface-variant">
            La cédula y el número de cuenta se dejan en blanco: el panel nunca los recibe completos,
            así que esos dos campos se llenan en el sheet.
            {problema && <span className="text-amber-600 font-medium"> · {problema}</span>}
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-on-surface-variant">
              <th className="py-1.5 px-1 font-medium">Persona</th>
              <th className="py-1.5 px-1 font-medium">Banco</th>
              <th className="py-1.5 px-1 font-medium">Cuenta</th>
              <th className="py-1.5 px-1 font-medium text-right">Monto</th>
              <th className="py-1.5 px-1 font-medium text-center">Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-high">
            {filas.map(p => (
              <tr key={`${p.indice}-${p.nombre}`}>
                <td className="py-1 px-1 text-on-surface">{p.nombre}</td>
                <td className="py-0.5 px-0.5 min-w-[130px]">
                  <CeldaTextoEditable
                    valor={p.banco}
                    editable={editable}
                    alGuardar={async nuevo => {
                      await guardarNomina({
                        indice: p.indice, nombreEsperado: p.nombre,
                        campo: 'banco', valor: nuevo, valorAnterior: p.banco,
                      })
                      refrescar()
                    }}
                  />
                </td>
                <td className="py-1 px-1 tabular-nums text-on-surface-variant/70">{p.cuenta || '—'}</td>
                <td className="py-0.5 px-0.5 min-w-[104px]">
                  <CeldaEditable
                    valor={p.monto || null}
                    editable={editable}
                    vacioComo="sin monto"
                    alGuardar={async nuevo => {
                      await guardarNomina({
                        indice: p.indice, nombreEsperado: p.nombre,
                        campo: 'monto', valor: nuevo, valorAnterior: p.monto || null,
                      })
                      refrescar()
                    }}
                  />
                </td>
                <td className="py-1 px-1 text-center">
                  <InterruptorEditable
                    valor={p.pagado}
                    editable={editable}
                    alGuardar={async nuevo => {
                      await guardarNomina({
                        indice: p.indice, nombreEsperado: p.nombre,
                        campo: 'pagado', valor: nuevo, valorAnterior: p.pagado,
                      })
                      refrescar()
                    }}
                  />
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-[13px] text-on-surface-variant">
                Nadie coincide con ese filtro
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10.5px] text-on-surface-variant/80 mt-3">
        La cédula no sale del servidor y de la cuenta solo viajan los últimos cuatro dígitos, así que
        esos dos campos no se pueden editar desde aquí.
      </p>
    </div>
  )
}

// ── producción de contenido ─────────────────────────────────────────────

export function TablaProduccion({ datos, editable }: { datos: GastosAgenciaData; editable: boolean }) {
  const qc = useQueryClient()
  const bloques = Object.entries(datos.produccion)
  if (!bloques.length) return null
  const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE })

  return (
    <div className="space-y-4">
      {bloques.map(([clave, b]) => (
        <div key={clave} className="card p-5">
          <Encabezado
            titulo={b.titulo}
            ayuda={editable
              ? 'Cantidad de piezas por mes. Clic para editar; se guarda en el sheet.'
              : 'Cantidad de piezas por mes, según el sheet.'}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                  <th className="text-left py-1.5 pr-3 font-medium">Tipo</th>
                  {MESES_CORTOS.map(m => (
                    <th key={m} className="py-1.5 px-1 font-medium text-right min-w-[62px]">{m}</th>
                  ))}
                  <th className="py-1.5 pl-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {b.tipos.map(t => (
                  <tr key={t.nombre} className="border-t border-surface-high">
                    <td className="py-1 pr-3 text-on-surface">{t.nombre}</td>
                    {t.valores.map((v, mes) => (
                      <td key={mes} className="py-0.5 px-0.5">
                        <CeldaEditable
                          valor={v}
                          formato="entero"
                          editable={editable}
                          alGuardar={async nuevo => {
                            await guardarProduccion({
                              bloqueTitulo: b.titulo, tipo: t.nombre, mes, valor: nuevo, valorAnterior: v,
                            })
                            refrescar()
                          }}
                        />
                      </td>
                    ))}
                    <td className="py-1 pl-3 text-right tabular-nums font-semibold text-on-surface">
                      {numero(t.valores.reduce<number>((a, v) => a + (v ?? 0), 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── tarifario ───────────────────────────────────────────────────────────

const TITULO_TARIFA: Record<string, string> = {
  salarios: 'Salarios fijos',
  videos: 'Videos',
  ediciones: 'Edición e incentivos',
}

export function TablaTarifario({ datos, editable }: { datos: GastosAgenciaData; editable: boolean }) {
  const qc = useQueryClient()
  const bloques = Object.entries(datos.tarifario).filter(([, b]) => b.items.length)
  if (!bloques.length) {
    return (
      <div className="card p-5">
        <p className="text-[13px] text-on-surface-variant text-center py-6">
          El tarifario no se pudo leer del sheet.
        </p>
      </div>
    )
  }
  const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {bloques.map(([clave, b]) => (
        <div key={clave} className="card p-5">
          <Encabezado
            titulo={TITULO_TARIFA[clave] ?? clave}
            ayuda={editable ? 'Clic en un valor para cambiarlo en el sheet.' : 'Tarifas vigentes según el sheet.'}
          />
          <div className="divide-y divide-surface-high">
            {b.items.map((it, i) => {
              const nuevaSeccion = it.seccion && (i === 0 || b.items[i - 1].seccion !== it.seccion)
              return (
                <div key={`${it.seccion ?? ''}-${it.concepto}`}>
                  {nuevaSeccion && (
                    <p className="text-[10px] uppercase tracking-wide text-on-surface-variant pt-2.5 pb-1">
                      {it.seccion}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 py-0.5">
                    <span className="text-[12px] text-on-surface min-w-0 truncate">{it.concepto}</span>
                    <span className="shrink-0 w-[118px]">
                      <CeldaEditable
                        valor={it.valor}
                        editable={editable}
                        alGuardar={async nuevo => {
                          await guardarTarifario({
                            bloque: clave as 'salarios' | 'videos' | 'ediciones',
                            concepto: it.concepto, valor: nuevo, valorAnterior: it.valor,
                          })
                          refrescar()
                        }}
                      />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-surface-high">
            <span className="text-[12px] font-semibold text-on-surface">Total</span>
            <span className="text-[12px] font-semibold tabular-nums text-on-surface">{formatCOP(b.total)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
