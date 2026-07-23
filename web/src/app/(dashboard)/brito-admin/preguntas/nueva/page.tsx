import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { NuevaPreguntaForm } from './NuevaPreguntaForm'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']

export default async function NuevaPreguntaPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if ((session.user as any).role !== 'ADMIN') redirect('/no-autorizado')

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Link href="/brito-admin" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Volver a Brito
      </Link>

      <PageHeader title="Nueva pregunta" subtitle="Se agrega al banco de preguntas y queda disponible para armar lecciones." />

      <NuevaPreguntaForm materias={MATERIAS} />
    </div>
  )
}
