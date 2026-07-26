// Color e icono de cada materia de Brito. Lo comparten el mapa y la lección.

export const MATERIAS = [
  'Lectura Crítica',
  'Matemáticas',
  'Sociales y Ciudadanas',
  'Ciencias Naturales',
  'Inglés',
] as const

export const MATERIA_INFO: Record<string, { color: string; oscuro: string; icono: string }> = {
  'Lectura Crítica': { color: '#7C6FDB', oscuro: '#5B4FB0', icono: '/brito/icons/lectura-critica.png' },
  'Matemáticas': { color: '#3B82D6', oscuro: '#2A63A8', icono: '/brito/icons/matematicas.png' },
  'Sociales y Ciudadanas': { color: '#D69A2D', oscuro: '#A87722', icono: '/brito/icons/sociales.png' },
  'Ciencias Naturales': { color: '#2FA37A', oscuro: '#23795A', icono: '/brito/icons/ciencias.png' },
  'Inglés': { color: '#D6598F', oscuro: '#A63F6C', icono: '/brito/icons/ingles.png' },
}

export function materiaInfo(materia: string) {
  return MATERIA_INFO[materia] ?? { color: '#1E5FA8', oscuro: '#154577', icono: '/brito/icons/libro.png' }
}
