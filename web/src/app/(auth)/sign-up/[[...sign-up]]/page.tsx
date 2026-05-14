import { redirect } from 'next/navigation'

// El registro libre está deshabilitado — el acceso solo lo otorga el admin
export default function SignUpPage() {
  redirect('/sign-in')
}
