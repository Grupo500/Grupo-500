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
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/Select'
import { CampoTelefono } from '@/components/ui/CampoTelefono'

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

function Campo({ label, valor, onCambio, ayuda, placeholder, ancho, falta }: {
  label: string; valor: string; onCambio: (v: string) => void
  ayuda?: string; placeholder?: string; ancho?: boolean
  /**
   * Marca el campo mientras esté vacío. Nació de un caso concreto: el campo
   * Banco tenía de ejemplo "Bancolombia" —un banco de verdad, escrito en gris
   * dentro del recuadro—, así que se leía como un dato ya puesto y se saltaba.
   * El aviso de arriba decía "falta el banco" y no había forma de relacionarlo
   * con el recuadro que lo tenía (Hotman, 20-ago). Ahora el propio campo lo
   * dice, y todos los ejemplos empiezan por "Ej." para que no se confundan
   * con algo escrito.
   */
  falta?: boolean
}) {
  return (
    <div className={ancho ? 'sm:col-span-2' : undefined}>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-on-surface-variant">
        {label}
        {falta && (
          <span className="rounded-full bg-[#d97706]/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#9a5b06]">
            Falta
          </span>
        )}
      </label>
      <input type="text" value={valor} placeholder={placeholder}
             onChange={e => onCambio(e.target.value)}
             className={cn('input-base', falta && 'border-[#d97706]/55 bg-[#d97706]/[0.05]')} />
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
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }))

  const guardar = useMutation({
    mutationFn: async () => {
      const token = await getClientToken()
      return createClientFetcher(token ?? '')('/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
    },
    // "En toda la plataforma" es literal. Estos datos se leen en Ajustes, en
    // Cobros, en el Planificador y en Entregables, y cada pantalla los pide con
    // su propia clave; ir nombrándolas una por una siempre dejaba alguna con lo
    // viejo, y la persona veía "falta el banco" después de haberlo guardado
    // (Hotman, 20-ago). Se invalida todo el cache y se vuelve a pedir lo que
    // esté en pantalla. El backend además avisa por SSE, para los demás.
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      await queryClient.refetchQueries({ type: 'active' })
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
               falta={!f.nombreCompleto.trim()} placeholder="Como aparece en tu cédula" />
        <Campo label="Cédula de ciudadanía" valor={f.cedula} onCambio={set('cedula')}
               falta={!f.cedula.trim()} placeholder="Ej. 1098765432" />
        <Campo label="Ciudad de expedición" valor={f.ciudadExpedicion} onCambio={set('ciudadExpedicion')}
               falta={!f.ciudadExpedicion.trim()} placeholder="Ej. Bucaramanga" />
        <Campo label="Ciudad" valor={f.ciudad} onCambio={set('ciudad')}
               falta={!f.ciudad.trim()} placeholder="Ej. Bucaramanga"
               ayuda="Desde dónde se emite la cuenta de cobro." />
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-on-surface-variant">
            Celular de contacto
            {!f.celular.trim() && (
              <span className="rounded-full bg-[#d97706]/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#9a5b06]">
                Falta
              </span>
            )}
          </label>
          <CampoTelefono valor={f.celular} onCambio={v => setF(p => ({ ...p, celular: v }))} placeholder="300 123 4567" />
        </div>
        <Campo ancho label="RUT" valor={f.rut} onCambio={set('rut')}
               falta={!f.rut.trim()} placeholder="Ej. 1098765432-1"
               ayuda="Lo pide contabilidad para soportar el pago." />
      </div>

      <p className="mb-4 border-t border-outline-variant/60 pt-4 text-[11px] font-semibold text-on-surface-variant">
        Cuenta para el pago
      </p>

      <div className="mb-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Banco" valor={f.banco} onCambio={set('banco')}
               falta={!f.banco.trim()} placeholder="Ej. Bancolombia" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Tipo de cuenta</label>
          <Select
            value={f.tipoCuenta}
            onValueChange={v => setF(p => ({ ...p, tipoCuenta: v }))}
            className="input-base"
            options={[{ value: 'AHORROS', label: 'Ahorros' }, { value: 'CORRIENTE', label: 'Corriente' }]}
          />
        </div>
        <Campo ancho label="N° de cuenta" valor={f.numeroCuenta} onCambio={set('numeroCuenta')}
               falta={!f.numeroCuenta.trim()} placeholder="Ej. 03212345678" />
        {/* La firma dibujada salió de aquí (Hotman, 20-ago): la cuenta de cobro
            se genera igual y firmarla con el dedo en el navegador daba un
            garabato distinto cada vez. El PDF deja la línea para firmar. */}
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
            <span className="opacity-45">___________________________</span>
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
