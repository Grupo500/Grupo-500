'use client'

import { usePathname, useRouter } from 'next/navigation'
import { etiquetaQuincena } from '@/lib/contabilidadMarketing'

export default function SelectorQuincena({ quincenas, actual }: { quincenas: string[]; actual: string }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <select
      value={actual}
      onChange={e => router.push(`${pathname}?q=${e.target.value}`)}
      className="px-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface cursor-pointer"
    >
      {quincenas.map(q => (
        <option key={q} value={q}>{etiquetaQuincena(q)}</option>
      ))}
    </select>
  )
}
