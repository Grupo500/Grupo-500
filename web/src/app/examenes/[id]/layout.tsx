import '../examen.css'

// Envuelve las pantallas de presentación del examen (y resultado) con la
// clase que aplica el diseño original de simulacros-grupo500, sin afectar
// el resto de la app de Grupo 500.
export default function ExamenLayout({ children }: { children: React.ReactNode }) {
  return <div className="examen-sim">{children}</div>
}
