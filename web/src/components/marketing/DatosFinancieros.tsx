'use client'

/**
 * Los datos con los que se arma la cuenta de cobro.
 *
 * Son los mismos que se escribían cada vez en el formulario de la landing, con
 * la diferencia de que aquí se llenan una sola vez: de los diez que pedía ese
 * formulario, seis son de la persona y no cambian de un mes a otro, y los otros
 * cuatro —fecha, periodo, concepto y valor— ya los tiene la app en el propio
 * trabajo.
 *
 * Arriba va el estado y no al final: lo que traba un pago no es el formulario,
 * es que alguien lo deja a medias y se descubre el día del giro. El mismo
 * cálculo lo hace el backend, así que Cobros marca a esa persona antes de que
 * la líder apruebe algo que después no se va a poder pagar.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save, Check, Landmark, AlertTriangle, FileText } from 'lucide-react'
import { getClientToken, createClientFetcher } from '@/lib/api'
import { Select } from '@/components/ui/Select'
import { CampoFirma } from './CampoFirma'

export interface Financieros {
  nombreCompleto: string | null
  cedula: string | null
  ciudadExpedicion: string | null
  ciudad: string | null
  celular: string | null
  rut: string | null
  banco: string | null
  tipoCuenta: string | null
  numeroCuenta: string | null
  firmaUrl: string | null
  falta: string[]
  completos: boolean
}

const enPesos = (n: number) => '$' + n.toLocaleString('es-CO')

function Campo({ label, valor, onCambio, ayuda, placeholder, ancho }: {
  label: string; valor: string; onCambio: (v: string) => void
  ayuda?: string; placeholder?: string; ancho?: boolean
}) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">{label}</label>
      <input type="text" value={valor} placeholder={placeholder}
             onChange={e => onCambio(e.target.value)} className="input-base" />
      {ayuda && <p className="mt-1 text-[11px] text-on-surface-variant">{ayuda}</p>}
    </div>
  )
}

export function DatosFinancieros({ inicial }: { inicial: Financieros }) {
  const queryClient = useQueryClient()
  const [f, setF] = useState({
    nombreCompleto:   inicial.nombreCompleto ?? '',
    cedula:           inicial.cedula ?? '',
    ciudadExpedicion: inicial.ciudadExpedicion ?? '',
    ciudad:           inicial.ciudad ?? '',
    celular:          inicial.celular ?? '',
    rut:              inicial.rut ?? '',
    banco:            inicial.banco ?? '',
    tipoCuenta:       inicial.tipoCuenta ?? 'AHORROS',
    numeroCuenta:     inicial.numeroCuenta ?? '',
  })
  const [firmaUrl, setFirmaUrl] = useState(inicial.firmaUrl)
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }))

  const guardar = useMutation({
    mutationFn: async () => {
      const token = await getClientToken()
      return createClientFetcher(token ?? '')('/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, firmaUrl }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-cuenta'] })
      queryClient.invalidateQueries({ queryKey: ['marketing-cobros'] })
    },
    onError: (e: any) => alert(e?.message ?? 'No se pudo guardar'),
  })

  // Se recalcula con lo que hay escrito ahora, no con lo guardado: el aviso
  // tiene que responder mientras se llena, no después de darle a Guardar.
  const falta = [
    !f.nombreCompleto.trim()   && 'tu nombre completo',
    !f.cedula.trim()           && 'tu cédula',
    !f.ciudadExpedicion.trim() && 'la ciudad de expedición',
    !f.ciudad.trim()           && 'tu ciudad',
    !f.celular.trim()          && 'tu celular',
    !f.rut.trim()              && 'tu RUT',
    !f.banco.trim()            && 'el banco',
    !f.numeroCuenta.trim()     && 'el número de cuenta',
    !firmaUrl                  && 'tu firma',
  ].filter(Boolean) as string[]

  const listo = falta.length === 0
  const hoy = new Date()

  return (
    <div className="card animate-card-enter p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0f766e]/12">
          <Landmark className="size-4 text-[#0f766e]" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-on-surface">Datos financieros</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Con esto se arma tu cuenta de cobro. Se llenan una sola vez.
          </p>
        </div>
      </div>

      {/* ── Estado ── */}
      <div className={[
        'mb-5 rounded-xl border px-4 py-3.5',
        listo ? 'border-[#16a34a]/35 bg-[#16a34a]/10' : 'border-[#d97706]/35 bg-[#d97706]/10',
      ].join(' ')}>
        <p className={[
          'flex items-center gap-2 text-[12.5px] font-semibold',
          listo ? 'text-[#0f7a35]' : 'text-[#9a5b06]',
        ].join(' ')}>
          {listo
            ? <><Check className="size-4" /> Todo listo para que te paguen</>
            : <><AlertTriangle className="size-4" /> Te {falta.length === 1 ? 'falta un dato' : `faltan ${falta.length} datos`} para que te podamos pagar</>}
        </p>
        {!listo && (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-on-surface-variant">
            Falta {falta.slice(0, -1).join(', ')}{falta.length > 1 ? ' y ' : ''}{falta[falta.length - 1]}.
          </p>
        )}
      </div>

      <div className="mb-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo ancho label="Nombre completo" valor={f.nombreCompleto} onCambio={set('nombreCompleto')}
               placeholder="Como aparece en tu cédula" />
        <Campo label="Cédula de ciudadanía" valor={f.cedula} onCambio={set('cedula')} placeholder="1098765432" />
        <Campo label="Ciudad de expedición" valor={f.ciudadExpedicion} onCambio={set('ciudadExpedicion')} placeholder="Bucaramanga" />
        <Campo label="Ciudad" valor={f.ciudad} onCambio={set('ciudad')} placeholder="Bucaramanga"
               ayuda="Desde dónde se emite la cuenta de cobro." />
        <Campo label="Celular de contacto" valor={f.celular} onCambio={set('celular')} placeholder="300 123 4567" />
        <Campo ancho label="RUT" valor={f.rut} onCambio={set('rut')} placeholder="1098765432-1"
               ayuda="Lo pide contabilidad para soportar el pago." />
      </div>

      <p className="mb-4 border-t border-outline-variant/60 pt-4 text-[11px] font-semibold text-on-surface-variant">
        Cuenta para el pago
      </p>

      <div className="mb-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Banco" valor={f.banco} onCambio={set('banco')} placeholder="Bancolombia" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Tipo de cuenta</label>
          <Select
            value={f.tipoCuenta}
            onValueChange={v => setF(p => ({ ...p, tipoCuenta: v }))}
            className="input-base"
            options={[{ value: 'AHORROS', label: 'Ahorros' }, { value: 'CORRIENTE', label: 'Corriente' }]}
          />
        </div>
        <Campo ancho label="N° de cuenta" valor={f.numeroCuenta} onCambio={set('numeroCuenta')} placeholder="03212345678" />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Firma</label>
          <CampoFirma valor={firmaUrl} onCambio={setFirmaUrl} />
          <p className="mt-1 text-[11px] text-on-surface-variant">Queda incrustada sobre la línea de firma del PDF.</p>
        </div>
      </div>

      {/* ── Previa ── */}
      <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant">
        <p className="flex items-center gap-2 border-b border-outline-variant bg-surface-low px-3.5 py-2.5 text-[11px] font-semibold text-on-surface-variant">
          <FileText className="size-3.5" /> Así va a quedar tu cuenta de cobro
        </p>
        <div className="px-4 py-3.5 text-[11.5px] leading-relaxed text-on-surface-variant">
          <p className="mb-2.5 text-center text-[12.5px] font-bold tracking-wide text-on-surface">CUENTA DE COBRO</p>
          {f.ciudad || '—'}, {hoy.getDate()} de {['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][hoy.getMonth()]} de {hoy.getFullYear()}<br />
          <span className="font-semibold text-on-surface">GRUPO 500 S.A.S.</span> debe a{' '}
          <span className="font-semibold text-on-surface">{f.nombreCompleto || '—'}</span>,
          C.C. {f.cedula || '—'}{f.ciudadExpedicion ? ` de ${f.ciudadExpedicion}` : ''}, la suma de{' '}
          <span className="font-semibold text-on-surface">{enPesos(450000)}</span> por concepto del trabajo
          que te aprueben, con su periodo y su valor reales.<br />
          Pago a cuenta de {f.tipoCuenta === 'CORRIENTE' ? 'corriente' : 'ahorros'} {f.banco || '—'} N° {f.numeroCuenta || '—'}.
          <div className="mt-3 border-t border-outline-variant pt-2 text-[10.5px]">
            {firmaUrl
              ? <img src={firmaUrl} alt="" className="mb-1 h-8 object-contain" />
              : <span className="opacity-45">___________________________</span>}
            <div>{f.nombreCompleto || '—'} · C.C. {f.cedula || '—'}{f.celular ? ` · ${f.celular}` : ''}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-outline-variant pt-4">
        {guardar.isSuccess && !guardar.isPending && (
          <span className="flex animate-slide-up items-center gap-1 text-xs font-medium text-secondary">
            <Check className="size-3.5" /> Guardado
          </span>
        )}
        <button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="btn-primary">
          {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar
        </button>
      </div>
    </div>
  )
}
