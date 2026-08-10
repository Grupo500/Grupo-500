'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cargarCsv, type ReporteCarga } from './acciones'

const PLANTILLA = [
  'nombre,tipo_documento,documento,correo,colegio,productos',
  'Ana María Pérez,TI,1098765432,ana.perez@gmail.com,Colegio San José,1 2',
  'Juan Camilo Ruiz,CC,1005432198,juan.ruiz@gmail.com,Colegio San José,2',
].join('\n')

export default function CargarCsv() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [reporte, setReporte] = useState<ReporteCarga | null>(null)
  const [pendiente, startTransition] = useTransition()

  const enviar = (formData: FormData) => {
    startTransition(async () => {
      setReporte(await cargarCsv(formData))
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <FileSpreadsheet className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-on-surface">Carga masiva por CSV</h2>
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Columnas: <code className="font-mono">nombre, tipo_documento, documento, correo, colegio, productos</code>.
        En <b>productos</b> van los IDs internos de los simulacros separados por espacio, «;» o «|».
        El documento es la contraseña con la que entra el estudiante. Las filas con error se
        reportan sin frenar el resto.{' '}
        <a
          className="text-primary underline underline-offset-2"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(PLANTILLA)}`}
          download="plantilla-accesos.csv"
        >
          Descargar plantilla
        </a>
      </p>

      <form action={enviar} className="flex items-center gap-3 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          name="archivo"
          accept=".csv,text/csv"
          required
          className="text-xs text-on-surface-variant file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-outline-variant file:bg-surface-high file:text-on-surface file:text-xs file:font-medium file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-60"
        >
          {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {pendiente ? 'Cargando…' : 'Cargar accesos'}
        </button>
      </form>

      {reporte && (
        <div className="mt-4 space-y-3">
          {reporte.error ? (
            <div className="flex items-start gap-2 text-xs text-error bg-error-container/40 border border-error/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{reporte.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-on-surface bg-surface-high rounded-lg p-3 flex-wrap">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span>
                  {reporte.total} filas procesadas · {reporte.estudiantesCreados} estudiantes nuevos ·{' '}
                  {reporte.estudiantesActualizados} actualizados · {reporte.accesosNuevos} accesos nuevos ·{' '}
                  {reporte.accesosReactivados} reactivados
                  {reporte.colegiosCreados.length > 0 && (
                    <> · colegios creados: {reporte.colegiosCreados.join(', ')}</>
                  )}
                </span>
              </div>

              {reporte.errores.length > 0 && (
                <div className="border border-outline-variant rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-surface-high text-xs font-semibold text-on-surface">
                    <AlertTriangle className="w-3.5 h-3.5 text-error" />
                    {reporte.errores.length} filas con error (no se cargaron)
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-outline-variant">
                    {reporte.errores.map((e, i) => (
                      <div key={i} className="px-3 py-1.5 text-xs text-on-surface-variant">
                        <span className="font-mono text-on-surface">Fila {e.fila}:</span> {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
