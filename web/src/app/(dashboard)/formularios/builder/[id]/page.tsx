'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getClientToken } from '@/lib/api'
import {
  ArrowLeft, Save, Eye, EyeOff, Plus, Trash2, Copy,
  GripVertical, Type, AlignLeft, Mail, Phone, Calendar,
  Hash, List, CheckSquare, ToggleLeft, Star, BarChart3,
  Paperclip, Minus, FileText, Loader2, Check, X,
  ChevronDown, ChevronUp, Settings2, MousePointerClick,
  AlertCircle, Smartphone, Monitor, SplitSquareVertical,
  Palette, Trophy, Heart, Rocket, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TipoCampo =
  | 'texto' | 'textarea' | 'email' | 'telefono' | 'fecha' | 'numero'
  | 'select' | 'radio' | 'checkbox_multi' | 'si_no'
  | 'escala' | 'nps' | 'archivo' | 'seccion' | 'parrafo' | 'header_image'

interface LogicaCondicional {
  campoId: string
  operador: 'igual' | 'no_igual' | 'contiene' | 'no_vacio'
  valor: string
}

interface Campo {
  id: string
  tipo: TipoCampo
  label: string
  placeholder?: string
  descripcion?: string
  requerido: boolean
  opciones?: string[]
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  escalaMax?: 5 | 10
  aceptar?: string
  contenido?: string
  url?: string
  logica?: LogicaCondicional
}

interface FormMeta {
  colorPrimario?:     string
  colorSecundario?:   string
  mensajeBienvenida?: string
  mensajeExito?:      string
  icono?:             'check' | 'star' | 'trophy' | 'heart' | 'rocket'
}

const COLORES_PRESET = [
  { label: 'Azul Grupo 500', value: '#21b9f7' },
  { label: 'Azul oscuro',    value: '#1a7de0' },
  { label: 'Verde',          value: '#10b981' },
  { label: 'Naranja',        value: '#f97316' },
  { label: 'Morado',         value: '#8b5cf6' },
  { label: 'Rosa',           value: '#ec4899' },
]

const ICONOS_EXITO: { id: FormMeta['icono']; icon: React.ElementType; label: string }[] = [
  { id: 'check',  icon: Check,   label: 'Confirmado' },
  { id: 'star',   icon: Star,    label: 'Estrella'   },
  { id: 'trophy', icon: Trophy,  label: 'Trofeo'     },
  { id: 'heart',  icon: Heart,   label: 'Corazón'    },
  { id: 'rocket', icon: Rocket,  label: 'Cohete'     },
]

// ── Panel de Apariencia ────────────────────────────────────────────────────────
function AparienciaPanel({ meta, onUpdate, onClose }: {
  meta: FormMeta
  onUpdate: (m: FormMeta) => void
  onClose: () => void
}) {
  const upd = (patch: Partial<FormMeta>) => onUpdate({ ...meta, ...patch })
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-sm text-on-surface focus:outline-none focus:border-primary transition-colors'
  const labelCls = 'text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5 block'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <Palette className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Apariencia</p>
            <p className="text-xs text-on-surface-variant">Personaliza el formulario</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-xl hover:bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

        {/* Color primario */}
        <div>
          <label className={labelCls}>Color primario</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {COLORES_PRESET.map(c => (
              <button key={c.value} onClick={() => upd({ colorPrimario: c.value })}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all active:scale-[0.97] cursor-pointer',
                  meta.colorPrimario === c.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-outline-variant text-on-surface-variant hover:border-outline',
                )}>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: c.value }} />
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-on-surface-variant">Personalizado:</label>
            <div className="flex items-center gap-2 flex-1">
              <input type="color" value={meta.colorPrimario ?? '#21b9f7'}
                onChange={e => upd({ colorPrimario: e.target.value })}
                className="w-9 h-9 rounded-lg border border-outline-variant cursor-pointer" />
              <input className={cn(inputCls, 'flex-1 font-mono text-xs')}
                value={meta.colorPrimario ?? '#21b9f7'}
                onChange={e => upd({ colorPrimario: e.target.value })}
                placeholder="#21b9f7" />
            </div>
          </div>
        </div>

        {/* Preview color */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-outline-variant">
          <div className="h-10 w-full" style={{ background: `linear-gradient(135deg, ${meta.colorPrimario ?? '#21b9f7'}, ${meta.colorPrimario ?? '#21b9f7'}dd)` }} />
          <div className="px-4 py-3 bg-surface-lowest">
            <p className="text-xs text-on-surface-variant">Vista previa del color</p>
            <div className="flex gap-2 mt-2">
              <div className="h-8 flex-1 rounded-lg border-2" style={{ borderColor: meta.colorPrimario ?? '#21b9f7' }} />
              <div className="h-8 px-4 rounded-lg text-white text-xs font-bold flex items-center" style={{ background: meta.colorPrimario ?? '#21b9f7' }}>Botón</div>
            </div>
          </div>
        </div>

        {/* Mensaje de bienvenida */}
        <div>
          <label className={labelCls}>Mensaje de bienvenida</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={3}
            value={meta.mensajeBienvenida ?? ''}
            onChange={e => upd({ mensajeBienvenida: e.target.value })}
            placeholder="Ej: Gracias por tu interés en Grupo 500. Completa el formulario y te contactaremos pronto." />
          <p className="text-xs text-on-surface-variant mt-1">Se muestra al inicio del formulario</p>
        </div>

        {/* Mensaje de éxito */}
        <div>
          <label className={labelCls}>Mensaje de éxito</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={3}
            value={meta.mensajeExito ?? ''}
            onChange={e => upd({ mensajeExito: e.target.value })}
            placeholder="Ej: ¡Inscripción recibida! En menos de 24 horas un asesor se comunicará contigo." />
          <p className="text-xs text-on-surface-variant mt-1">Se muestra al completar el formulario</p>
        </div>

        {/* Icono de éxito */}
        <div>
          <label className={labelCls}>Icono de éxito</label>
          <div className="grid grid-cols-5 gap-2">
            {ICONOS_EXITO.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => upd({ icono: id })}
                title={label}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all active:scale-[0.97] cursor-pointer',
                  meta.icono === id || (!meta.icono && id === 'check')
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant hover:border-outline',
                )}>
                <Icon className={cn('w-5 h-5', meta.icono === id || (!meta.icono && id === 'check') ? 'text-primary' : 'text-on-surface-variant')} />
                <span className="text-[9px] text-on-surface-variant">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Config visual por tipo ─────────────────────────────────────────────────────
const TIPOS_CONFIG: Record<TipoCampo, { label: string; icon: React.ElementType; color: string; bg: string; categoria: string }> = {
  texto:         { label: 'Texto corto',       icon: Type,               color: 'text-blue-600',    bg: 'bg-blue-50',    categoria: 'Básico' },
  textarea:      { label: 'Texto largo',        icon: AlignLeft,          color: 'text-indigo-600',  bg: 'bg-indigo-50',  categoria: 'Básico' },
  email:         { label: 'Correo',             icon: Mail,               color: 'text-violet-600',  bg: 'bg-violet-50',  categoria: 'Básico' },
  telefono:      { label: 'Teléfono',           icon: Phone,              color: 'text-purple-600',  bg: 'bg-purple-50',  categoria: 'Básico' },
  numero:        { label: 'Número',             icon: Hash,               color: 'text-pink-600',    bg: 'bg-pink-50',    categoria: 'Básico' },
  fecha:         { label: 'Fecha',              icon: Calendar,           color: 'text-rose-600',    bg: 'bg-rose-50',    categoria: 'Básico' },
  select:        { label: 'Desplegable',        icon: List,               color: 'text-amber-600',   bg: 'bg-amber-50',   categoria: 'Selección' },
  radio:         { label: 'Selección única',    icon: MousePointerClick,  color: 'text-orange-600',  bg: 'bg-orange-50',  categoria: 'Selección' },
  checkbox_multi:{ label: 'Selección múltiple', icon: CheckSquare,        color: 'text-yellow-600',  bg: 'bg-yellow-50',  categoria: 'Selección' },
  si_no:         { label: 'Sí / No',            icon: ToggleLeft,         color: 'text-lime-600',    bg: 'bg-lime-50',    categoria: 'Selección' },
  escala:        { label: 'Escala de valoración',icon: Star,              color: 'text-emerald-600', bg: 'bg-emerald-50', categoria: 'Especial' },
  nps:           { label: 'NPS (0-10)',          icon: BarChart3,         color: 'text-teal-600',    bg: 'bg-teal-50',    categoria: 'Especial' },
  archivo:       { label: 'Subir archivo',       icon: Paperclip,         color: 'text-cyan-600',    bg: 'bg-cyan-50',    categoria: 'Especial' },
  seccion:       { label: 'Sección / Divisor',   icon: Minus,             color: 'text-slate-500',   bg: 'bg-slate-100',  categoria: 'Contenido' },
  parrafo:       { label: 'Párrafo informativo', icon: FileText,          color: 'text-slate-600',   bg: 'bg-slate-100',  categoria: 'Contenido' },
  header_image:  { label: 'Imagen de encabezado',icon: SplitSquareVertical,color:'text-slate-500',   bg: 'bg-slate-100',  categoria: 'Contenido' },
}

const CATEGORIAS = ['Básico', 'Selección', 'Especial', 'Contenido']
const TIPOS_PALETA: TipoCampo[] = [
  'texto','textarea','email','telefono','numero','fecha',
  'select','radio','checkbox_multi','si_no',
  'escala','nps','archivo',
  'seccion','parrafo',
]

function uid() { return Math.random().toString(36).slice(2, 10) }

// ── Componente: Tarjeta de campo en el canvas ─────────────────────────────────
function CampoCard({
  campo, isSelected, onSelect, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, isDragOver,
}: {
  campo: Campo
  isSelected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  isDragOver: boolean
}) {
  const cfg = TIPOS_CONFIG[campo.tipo]
  const Icon = cfg.icon

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={cn(
        'group relative rounded-2xl border-2 transition-all duration-150 cursor-pointer select-none',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-outline-variant bg-surface-lowest hover:border-primary/40 hover:shadow-sm',
        isDragOver && 'border-primary border-dashed scale-[1.01]',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Drag handle */}
        <div className="text-on-surface-variant/30 group-hover:text-on-surface-variant/60 transition-colors cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Icono tipo */}
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
          <Icon className={cn('w-4 h-4', cfg.color)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{campo.label || 'Sin título'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-on-surface-variant">{cfg.label}</span>
            {campo.requerido && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 rounded-full">Requerido</span>
            )}
            {campo.logica && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded-full">Condicional</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onDuplicate}
            className="w-8 h-8 rounded-lg hover:bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all active:scale-95 cursor-pointer">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-on-surface-variant hover:text-red-500 transition-all active:scale-95 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente: Panel de configuración del campo ───────────────────────────────
function SettingsPanel({ campo, campos, onUpdate, onClose }: {
  campo: Campo
  campos: Campo[]
  onUpdate: (c: Campo) => void
  onClose: () => void
}) {
  const cfg = TIPOS_CONFIG[campo.tipo]
  const Icon = cfg.icon

  const upd = (patch: Partial<Campo>) => onUpdate({ ...campo, ...patch })

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-sm text-on-surface focus:outline-none focus:border-primary transition-colors'
  const labelCls = 'text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5 block'

  // Opciones para select/radio/checkbox_multi
  const [newOpcion, setNewOpcion] = useState('')

  function addOpcion() {
    if (!newOpcion.trim()) return
    upd({ opciones: [...(campo.opciones ?? []), newOpcion.trim()] })
    setNewOpcion('')
  }

  function removeOpcion(i: number) {
    upd({ opciones: campo.opciones?.filter((_, idx) => idx !== i) })
  }

  const tieneOpciones = ['select', 'radio', 'checkbox_multi'].includes(campo.tipo)
  const tieneTexto    = ['texto', 'textarea', 'email', 'telefono'].includes(campo.tipo)
  const tieneNumero   = campo.tipo === 'numero'
  const esEscala      = campo.tipo === 'escala'
  const esArchivo     = campo.tipo === 'archivo'
  const esContenido   = ['seccion', 'parrafo'].includes(campo.tipo)
  const puedeRequerir = !['seccion', 'parrafo', 'header_image'].includes(campo.tipo)
  const tienePlaceholder = ['texto', 'textarea', 'email', 'telefono', 'numero', 'select'].includes(campo.tipo)

  // Campos disponibles para lógica condicional (excluyendo el actual y secciones)
  const camposLogica = campos.filter(c => c.id !== campo.id && !['seccion', 'parrafo', 'header_image'].includes(c.tipo))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', cfg.bg)}>
            <Icon className={cn('w-4 h-4', cfg.color)} />
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">{cfg.label}</p>
            <p className="text-xs text-on-surface-variant">Configuración</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-xl hover:bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings scroll */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Label */}
        <div>
          <label className={labelCls}>Etiqueta *</label>
          <input className={inputCls} value={campo.label}
            onChange={e => upd({ label: e.target.value })}
            placeholder="Escribe la pregunta o título..." />
        </div>

        {/* Placeholder */}
        {tienePlaceholder && (
          <div>
            <label className={labelCls}>Placeholder</label>
            <input className={inputCls} value={campo.placeholder ?? ''}
              onChange={e => upd({ placeholder: e.target.value })}
              placeholder="Texto de ayuda dentro del campo..." />
          </div>
        )}

        {/* Descripción */}
        {!esContenido && (
          <div>
            <label className={labelCls}>Descripción / Hint</label>
            <textarea className={cn(inputCls, 'resize-none')} rows={2}
              value={campo.descripcion ?? ''}
              onChange={e => upd({ descripcion: e.target.value })}
              placeholder="Texto de ayuda debajo de la etiqueta..." />
          </div>
        )}

        {/* Contenido párrafo */}
        {campo.tipo === 'parrafo' && (
          <div>
            <label className={labelCls}>Texto del párrafo</label>
            <textarea className={cn(inputCls, 'resize-none')} rows={4}
              value={campo.contenido ?? ''}
              onChange={e => upd({ contenido: e.target.value })}
              placeholder="Escribe el texto informativo que verá el usuario..." />
          </div>
        )}

        {/* Requerido */}
        {puedeRequerir && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-high">
            <div>
              <p className="text-sm font-semibold text-on-surface">Campo requerido</p>
              <p className="text-xs text-on-surface-variant">El usuario debe completarlo</p>
            </div>
            <button onClick={() => upd({ requerido: !campo.requerido })}
              className={cn(
                'w-12 h-6 rounded-full transition-all duration-200 relative cursor-pointer shrink-0',
                campo.requerido ? 'bg-primary' : 'bg-outline-variant',
              )}>
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200',
                campo.requerido ? 'left-6' : 'left-0.5',
              )} />
            </button>
          </div>
        )}

        {/* Límites de texto */}
        {tieneTexto && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mín. caracteres</label>
              <input type="number" min={0} className={inputCls}
                value={campo.minLength ?? ''} placeholder="0"
                onChange={e => upd({ minLength: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className={labelCls}>Máx. caracteres</label>
              <input type="number" min={0} className={inputCls}
                value={campo.maxLength ?? ''} placeholder="Sin límite"
                onChange={e => upd({ maxLength: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
        )}

        {/* Límites número */}
        {tieneNumero && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Valor mínimo</label>
              <input type="number" className={inputCls}
                value={campo.min ?? ''} placeholder="Sin mínimo"
                onChange={e => upd({ min: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className={labelCls}>Valor máximo</label>
              <input type="number" className={inputCls}
                value={campo.max ?? ''} placeholder="Sin máximo"
                onChange={e => upd({ max: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
        )}

        {/* Opciones (select / radio / checkbox_multi) */}
        {tieneOpciones && (
          <div>
            <label className={labelCls}>Opciones</label>
            <div className="space-y-2 mb-2">
              {(campo.opciones ?? []).map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-sm">
                    <GripVertical className="w-3.5 h-3.5 text-on-surface-variant/40 shrink-0" />
                    <input
                      className="flex-1 bg-transparent outline-none text-on-surface"
                      value={op}
                      onChange={e => {
                        const opts = [...(campo.opciones ?? [])]
                        opts[i] = e.target.value
                        upd({ opciones: opts })
                      }}
                    />
                  </div>
                  <button onClick={() => removeOpcion(i)}
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-on-surface-variant hover:text-red-500 transition-all cursor-pointer shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={cn(inputCls, 'flex-1')}
                value={newOpcion} placeholder="Nueva opción..."
                onChange={e => setNewOpcion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOpcion()} />
              <button onClick={addOpcion}
                className="px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all active:scale-[0.97] cursor-pointer shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Escala */}
        {esEscala && (
          <div>
            <label className={labelCls}>Rango de la escala</label>
            <div className="grid grid-cols-2 gap-3">
              {([5, 10] as const).map(v => (
                <button key={v} onClick={() => upd({ escalaMax: v })}
                  className={cn(
                    'py-3 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer',
                    campo.escalaMax === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary/50',
                  )}>
                  1 — {v} {v === 5 ? '⭐' : '🌟'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Archivo - tipos aceptados */}
        {esArchivo && (
          <div>
            <label className={labelCls}>Tipos de archivo aceptados</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Imágenes', value: 'image/*' },
                { label: 'PDF', value: 'application/pdf' },
                { label: 'Todos', value: 'image/*,.pdf' },
              ].map(opt => (
                <button key={opt.value} onClick={() => upd({ aceptar: opt.value })}
                  className={cn(
                    'py-2 rounded-xl border-2 text-xs font-semibold transition-all cursor-pointer',
                    campo.aceptar === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary/50',
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lógica condicional */}
        {camposLogica.length > 0 && !esContenido && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={cn(labelCls, 'mb-0')}>Lógica condicional</label>
              {campo.logica ? (
                <button onClick={() => upd({ logica: undefined })}
                  className="text-xs text-red-500 hover:underline cursor-pointer">Quitar</button>
              ) : (
                <button onClick={() => upd({ logica: { campoId: camposLogica[0].id, operador: 'igual', valor: '' } })}
                  className="text-xs text-primary hover:underline cursor-pointer">+ Agregar</button>
              )}
            </div>
            {campo.logica && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                <p className="text-xs text-amber-700 font-medium">Mostrar este campo solo si:</p>
                <select className={inputCls} value={campo.logica.campoId}
                  onChange={e => upd({ logica: { ...campo.logica!, campoId: e.target.value } })}>
                  {camposLogica.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <select className={inputCls} value={campo.logica.operador}
                  onChange={e => upd({ logica: { ...campo.logica!, operador: e.target.value as any } })}>
                  <option value="igual">es igual a</option>
                  <option value="no_igual">no es igual a</option>
                  <option value="contiene">contiene</option>
                  <option value="no_vacio">no está vacío</option>
                </select>
                {campo.logica.operador !== 'no_vacio' && (
                  <input className={inputCls} placeholder="Valor..."
                    value={campo.logica.valor}
                    onChange={e => upd({ logica: { ...campo.logica!, valor: e.target.value } })} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente: Preview del campo ─────────────────────────────────────────────
function CampoPreview({ campo }: { campo: Campo }) {
  const base = 'w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-800 text-sm bg-white focus:outline-none focus:border-[#21b9f7] transition-all placeholder:text-slate-400'

  if (campo.tipo === 'header_image' && campo.url) {
    return <img src={campo.url} alt="Header" className="w-full object-cover rounded-2xl" style={{ maxHeight: 140 }} />
  }
  if (campo.tipo === 'seccion') {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{campo.label}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    )
  }
  if (campo.tipo === 'parrafo') {
    return <p className="text-sm text-slate-600 leading-relaxed">{campo.contenido || campo.label}</p>
  }
  if (campo.tipo === 'textarea') {
    return <textarea className={cn(base, 'resize-none')} rows={3} placeholder={campo.placeholder || 'Escribe aquí...'} readOnly />
  }
  if (campo.tipo === 'select') {
    return (
      <select className={cn(base, 'cursor-pointer')}>
        <option value="">{campo.placeholder || 'Selecciona una opción'}</option>
        {(campo.opciones ?? []).map((op, i) => <option key={i}>{op}</option>)}
      </select>
    )
  }
  if (campo.tipo === 'radio') {
    return (
      <div className="space-y-2">
        {(campo.opciones ?? ['Opción 1', 'Opción 2']).map((op, i) => (
          <label key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-[#21b9f7] transition-all">
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
            <span className="text-sm text-slate-700">{op}</span>
          </label>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'checkbox_multi') {
    return (
      <div className="space-y-2">
        {(campo.opciones ?? ['Opción 1', 'Opción 2']).map((op, i) => (
          <label key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-[#21b9f7] transition-all">
            <div className="w-5 h-5 rounded-lg border-2 border-slate-300 shrink-0" />
            <span className="text-sm text-slate-700">{op}</span>
          </label>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'si_no') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['Sí', 'No'].map(op => (
          <button key={op} className="py-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#21b9f7] hover:bg-blue-50 transition-all cursor-pointer">
            {op === 'Sí' ? '👍 Sí' : '👎 No'}
          </button>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'escala') {
    const max = campo.escalaMax ?? 5
    return (
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} className="w-11 h-11 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:border-[#21b9f7] hover:bg-blue-50 hover:text-[#21b9f7] transition-all cursor-pointer">
            {n}
          </button>
        ))}
      </div>
    )
  }
  if (campo.tipo === 'nps') {
    return (
      <div>
        <div className="flex gap-1.5 flex-wrap mb-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map(n => (
            <button key={n} className="w-10 h-10 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-600 hover:border-[#21b9f7] hover:bg-blue-50 transition-all cursor-pointer">
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Muy improbable</span>
          <span>Muy probable</span>
        </div>
      </div>
    )
  }
  if (campo.tipo === 'archivo') {
    return (
      <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 cursor-pointer hover:border-[#21b9f7] transition-all">
        <Paperclip className="w-5 h-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Toca para seleccionar</p>
          <p className="text-xs text-slate-400 mt-0.5">Imagen o PDF — máx. 10 MB</p>
        </div>
      </label>
    )
  }

  const inputType = campo.tipo === 'email' ? 'email' : campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'fecha' ? 'date' : campo.tipo === 'numero' ? 'number' : 'text'
  return <input type={inputType} className={base} placeholder={campo.placeholder || 'Respuesta...'} readOnly />
}

// ── Página principal del Builder ───────────────────────────────────────────────
export default function FormBuilderPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const queryClient = useQueryClient()
  const isNew     = id === 'nuevo'

  const [nombre,      setNombre]      = useState('Nuevo formulario')
  const [descripcion, setDescripcion] = useState('')
  const [campos,      setCampos]      = useState<Campo[]>([])
  const [meta,        setMeta]        = useState<FormMeta>({ colorPrimario: '#21b9f7', icono: 'check' })
  const [selected,       setSelected]       = useState<string | null>(null)
  const [showApariencia, setShowApariencia]  = useState(false)
  const [preview,        setPreview]         = useState(false)
  const [saveStatus,     setSaveStatus]      = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [dragId,         setDragId]          = useState<string | null>(null)
  const [dragOverId,     setDragOverId]      = useState<string | null>(null)
  const [editingName,    setEditingName]     = useState(false)
  const [initialized,    setInitialized]     = useState(false)
  const nameRef    = useRef<HTMLInputElement>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Cargar formulario existente ──────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['formulario', id],
    queryFn:  () => apiFetch<any>(`/formularios/${id}`),
    enabled:  !isNew,
  })

  useEffect(() => {
    if (data?.data) {
      setNombre(data.data.nombre ?? '')
      setDescripcion(data.data.descripcion ?? '')
      setCampos((data.data.campos as Campo[]) ?? [])
      if (data.data.meta) setMeta(data.data.meta as FormMeta)
      setTimeout(() => setInitialized(true), 100) // evitar autosave en la carga inicial
    }
  }, [data?.data?.id])

  useEffect(() => {
    if (isNew) { setInitialized(true) }
  }, [isNew])

  // ── Autosave con debounce ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized || isNew) return // no autosave en formularios nuevos (requieren POST)
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    setSaveStatus('idle')
    autoSaveRef.current = setTimeout(() => {
      saveMutation.mutate()
    }, 1500)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [campos, nombre, descripcion, meta, initialized])

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getClientToken()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
      const url    = isNew ? `${apiUrl}/formularios` : `${apiUrl}/formularios/${id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ nombre, descripcion, campos, meta }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar')
      return json.data
    },
    onMutate: () => setSaveStatus('saving'),
    onSuccess: (data) => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
      queryClient.invalidateQueries({ queryKey: ['formularios'] })
      if (isNew && data?.id) router.replace(`/formularios/builder/${data.id}`)
    },
    onError: () => {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
  })

  // ── Campos helpers ───────────────────────────────────────────────────────────
  function agregar(tipo: TipoCampo) {
    const cfg = TIPOS_CONFIG[tipo]
    const nuevo: Campo = {
      id:       uid(),
      tipo,
      label:    cfg.label,
      requerido: !['seccion', 'parrafo', 'header_image', 'si_no', 'archivo', 'escala', 'nps'].includes(tipo),
      ...(tipo === 'select' || tipo === 'radio' || tipo === 'checkbox_multi' ? { opciones: ['Opción 1', 'Opción 2'] } : {}),
      ...(tipo === 'escala' ? { escalaMax: 5 } : {}),
      ...(tipo === 'archivo' ? { aceptar: 'image/*,.pdf' } : {}),
    }
    setCampos(p => [...p, nuevo])
    setSelected(nuevo.id)
  }

  function actualizar(id: string, c: Campo) {
    setCampos(p => p.map(x => x.id === id ? c : x))
  }

  function duplicar(id: string) {
    const idx = campos.findIndex(c => c.id === id)
    if (idx === -1) return
    const copia = { ...campos[idx], id: uid() }
    const next = [...campos]
    next.splice(idx + 1, 0, copia)
    setCampos(next)
    setSelected(copia.id)
  }

  function eliminar(id: string) {
    setCampos(p => p.filter(c => c.id !== id))
    setSelected(null)
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    setDragOverId(id)
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const from = campos.findIndex(c => c.id === dragId)
    const to   = campos.findIndex(c => c.id === targetId)
    const next = [...campos]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setCampos(next)
    setDragId(null)
    setDragOverId(null)
  }

  const selectedCampo = campos.find(c => c.id === selected)

  // ── Categorías para la paleta ─────────────────────────────────────────────────
  const tiposPorCategoria = CATEGORIAS.map(cat => ({
    cat,
    tipos: TIPOS_PALETA.filter(t => TIPOS_CONFIG[t].categoria === cat),
  }))

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!isNew && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-low">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--surface-low)] overflow-hidden">
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant bg-surface-lowest shrink-0 z-10">
        {/* Back */}
        <button onClick={() => router.push('/formularios')}
          className="w-9 h-9 rounded-xl hover:bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all active:scale-[0.97] cursor-pointer shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Nombre editable */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {editingName ? (
            <input
              ref={nameRef}
              autoFocus
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              className="text-sm font-bold text-on-surface bg-transparent border-b-2 border-primary outline-none min-w-0 flex-1"
            />
          ) : (
            <button onClick={() => setEditingName(true)}
              className="text-sm font-bold text-on-surface hover:text-primary transition-colors truncate cursor-pointer text-left">
              {nombre || 'Formulario sin título'}
            </button>
          )}
        </div>

        {/* Contador campos */}
        <span className="text-xs text-on-surface-variant hidden sm:block">
          {campos.length} campo{campos.length !== 1 ? 's' : ''}
        </span>

        {/* Apariencia */}
        <button onClick={() => { setShowApariencia(!showApariencia); setSelected(null) }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] cursor-pointer',
            showApariencia
              ? 'bg-violet-100 text-violet-700'
              : 'bg-surface-high text-on-surface-variant hover:text-on-surface hover:bg-surface-highest',
          )}>
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Apariencia</span>
        </button>

        {/* Preview toggle */}
        <button onClick={() => setPreview(!preview)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] cursor-pointer',
            preview
              ? 'bg-primary/10 text-primary'
              : 'bg-surface-high text-on-surface-variant hover:text-on-surface hover:bg-surface-highest',
          )}>
          {preview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="hidden sm:inline">{preview ? 'Editar' : 'Vista previa'}</span>
        </button>

        {/* Status autosave + botón guardar manual */}
        {!isNew && (
          <div className={cn(
            'hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-300',
            saveStatus === 'saving' && 'text-on-surface-variant',
            saveStatus === 'saved'  && 'text-emerald-600 bg-emerald-50',
            saveStatus === 'error'  && 'text-red-500 bg-red-50',
            saveStatus === 'idle'   && 'text-on-surface-variant/50',
          )}>
            {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>}
            {saveStatus === 'saved'  && <><Check className="w-3 h-3" /> Guardado</>}
            {saveStatus === 'error'  && <>⚠ Error al guardar</>}
            {saveStatus === 'idle'   && <>Autoguardado activo</>}
          </div>
        )}

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60',
            saveStatus === 'saved'
              ? 'bg-emerald-500 text-white'
              : 'bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20',
          )}>
          {saveMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : saveStatus === 'saved'
              ? <Check className="w-4 h-4" />
              : <Save className="w-4 h-4" />
          }
          <span className="hidden sm:inline">
            {saveMutation.isPending ? 'Guardando...' : saveStatus === 'saved' ? 'Guardado' : 'Guardar'}
          </span>
        </button>
      </header>

      {/* ── Contenido principal ───────────────────────────────────────────────── */}
      {preview ? (
        /* MODO PREVIEW */
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] p-4 sm:p-8">
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 space-y-5">
                {campos.length === 0 ? (
                  <div className="text-center py-10">
                    <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Sin campos todavía</p>
                    <p className="text-slate-400 text-sm">Vuelve al editor y agrega campos</p>
                  </div>
                ) : (
                  campos.map((campo, i) => (
                    <div key={campo.id} style={{ animation: `fadeSlideIn 0.2s ease-out ${i * 30}ms both` }}>
                      {campo.tipo !== 'seccion' && campo.tipo !== 'parrafo' && campo.tipo !== 'header_image' && (
                        <div className="mb-1.5">
                          <label className="text-sm font-semibold text-slate-700">
                            {campo.label}
                            {campo.requerido && <span className="text-red-400 ml-0.5">*</span>}
                          </label>
                          {campo.descripcion && (
                            <p className="text-xs text-slate-400 mt-0.5">{campo.descripcion}</p>
                          )}
                        </div>
                      )}
                      <CampoPreview campo={campo} />
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="text-center text-white/40 text-xs mt-4">Desarrollado por NexCode97</p>
          </div>
          <style>{`@keyframes fadeSlideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
      ) : (
        /* MODO EDITOR */
        <div className="flex-1 flex overflow-hidden">

          {/* ── Panel izquierdo: Paleta ──────────────────────────────────────── */}
          <aside className="w-[230px] shrink-0 border-r border-outline-variant bg-surface-lowest flex flex-col overflow-y-auto">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Campos</p>
            </div>
            <div className="flex-1 px-3 pb-4 space-y-4">
              {tiposPorCategoria.map(({ cat, tipos }) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest px-1 mb-1.5">{cat}</p>
                  <div className="space-y-1">
                    {tipos.map(tipo => {
                      const cfg = TIPOS_CONFIG[tipo]
                      const Icon = cfg.icon
                      return (
                        <button key={tipo} onClick={() => agregar(tipo)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                            text-on-surface-variant hover:text-on-surface hover:bg-surface-high
                            transition-all active:scale-[0.97] cursor-pointer group text-left">
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all', cfg.bg)}>
                            <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                          </div>
                          <span className="text-xs font-medium truncate">{cfg.label}</span>
                          <Plus className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* ── Canvas central ───────────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">

              {/* Descripción del formulario */}
              <div className="mb-6 p-4 rounded-2xl bg-surface-lowest border border-outline-variant">
                <input
                  className="w-full text-lg font-bold text-on-surface bg-transparent outline-none placeholder:text-on-surface-variant/40"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Nombre del formulario..."
                />
                <input
                  className="w-full text-sm text-on-surface-variant bg-transparent outline-none mt-1 placeholder:text-on-surface-variant/30"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Descripción opcional..."
                />
              </div>

              {/* Lista de campos */}
              {campos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed border-outline-variant text-center">
                  <div className="w-16 h-16 rounded-2xl bg-surface-high flex items-center justify-center mb-4">
                    <Plus className="w-8 h-8 text-on-surface-variant/40" />
                  </div>
                  <p className="font-semibold text-on-surface-variant mb-1">Empieza agregando campos</p>
                  <p className="text-sm text-on-surface-variant/60">Selecciona un tipo en el panel izquierdo</p>
                </div>
              ) : (
                <div className="space-y-2"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); setDragId(null); setDragOverId(null) }}>
                  {campos.map(campo => (
                    <CampoCard
                      key={campo.id}
                      campo={campo}
                      isSelected={selected === campo.id}
                      onSelect={() => setSelected(selected === campo.id ? null : campo.id)}
                      onDuplicate={() => duplicar(campo.id)}
                      onDelete={() => eliminar(campo.id)}
                      onDragStart={e => handleDragStart(e, campo.id)}
                      onDragOver={e => handleDragOver(e, campo.id)}
                      onDrop={e => handleDrop(e, campo.id)}
                      isDragOver={dragOverId === campo.id}
                    />
                  ))}
                </div>
              )}

              {/* Botón agregar al final */}
              {campos.length > 0 && (
                <div className="mt-4 pt-4 border-t border-outline-variant/50">
                  <p className="text-xs text-on-surface-variant text-center">
                    Arrastra para reordenar · Clic en un campo para editarlo
                  </p>
                </div>
              )}
            </div>
          </main>

          {/* ── Panel derecho: Settings / Apariencia ─────────────────────── */}
          <aside className={cn(
            'shrink-0 border-l border-outline-variant bg-surface-lowest transition-all duration-300 overflow-hidden',
            (selectedCampo || showApariencia) ? 'w-[300px]' : 'w-0',
          )}>
            {showApariencia && (
              <AparienciaPanel
                meta={meta}
                onUpdate={setMeta}
                onClose={() => setShowApariencia(false)}
              />
            )}
            {selectedCampo && !showApariencia && (
              <SettingsPanel
                campo={selectedCampo}
                campos={campos}
                onUpdate={c => actualizar(c.id, c)}
                onClose={() => setSelected(null)}
              />
            )}
          </aside>
        </div>
      )}

      {/* Error */}
      {saveMutation.isError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-600 font-medium">{(saveMutation.error as Error)?.message}</p>
        </div>
      )}
    </div>
  )
}
