import { redirect } from 'next/navigation'

// Unificado: ya no hay pantalla de login separada para estudiantes.
// Todos entran por /sign-in (mismo campo "contraseña" = documento para estudiantes).
export default function AccesoEstudiantePage() {
  redirect('/sign-in')
}
