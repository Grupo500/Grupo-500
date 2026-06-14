import { redirect } from 'next/navigation'

// La raíz no tiene landing: redirige al dashboard.
// El middleware envía a /sign-in si no hay sesión.
export default function RootPage() {
  redirect('/dashboard')
}
