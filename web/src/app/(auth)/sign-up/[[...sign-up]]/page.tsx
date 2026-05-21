import { redirect } from 'next/navigation'

// El registro de usuarios es gestionado por el administrador desde el panel.
// No hay registro público disponible.
export default function SignUpPage() {
  redirect('/sign-in')
}
