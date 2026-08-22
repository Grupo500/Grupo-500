/** La tarjeta de cada bloque de Ajustes: título, una línea de qué es, y el contenido. */
export function Tarjeta({ titulo, descripcion, accion, children }: {
  titulo: string
  descripcion?: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-lowest p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-on-surface">{titulo}</h3>
          {descripcion && <p className="mt-0.5 text-[12px] text-on-surface-variant">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  )
}
