// Comprueba que ninguna credencial de query string sobreviva a la redacción.
import { redactarUrl, tieneParamSensible } from '../src/utils/redactar'

const CASOS: [string, string][] = [
  // Los dos que aparecían de verdad en los logs de producción
  ['/api/eventos?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhYmMiLCJyb2xlIjoiQURNSU4ifQ.firma',
   '/api/eventos?token=***'],
  ['/api/trengo/webhook?secreto=de8215433b1c38bb02b9b0cd5b177744bc27a1bc',
   '/api/trengo/webhook?secreto=***'],
  // Mezclas: lo inocuo se conserva para que el log siga sirviendo
  ['/api/finanzas/gastos-agencia?refrescar=1', '/api/finanzas/gastos-agencia?refrescar=1'],
  ['/api/x?desde=2026-01-01&token=abc&hasta=2026-02-01',
   '/api/x?desde=2026-01-01&token=***&hasta=2026-02-01'],
  ['/api/x?TOKEN=abc', '/api/x?TOKEN=***'],
  ['/api/x?api_key=abc&page=2', '/api/x?api_key=***&page=2'],
  ['/api/x?code=4/0Ad&state=xyz', '/api/x?code=***&state=xyz'],
  // Sin query, y casos raros que no deben romper
  ['/health', '/health'],
  ['/api/x?', '/api/x?'],
  ['/api/x?soloflag', '/api/x?soloflag'],
  ['/api/x?token=', '/api/x?token=***'],
  ['/api/x?tokenizado=abc', '/api/x?tokenizado=abc'], // no es "token", no se toca
]

let fallos = 0
for (const [entrada, esperado] of CASOS) {
  const salida = redactarUrl(entrada)
  const ok = salida === esperado
  if (!ok) fallos++
  console.log(`${ok ? 'OK  ' : '### '} ${entrada}\n     -> ${salida}${ok ? '' : `\n     esperaba: ${esperado}`}`)
}

// Ninguna salida debe contener un JWT ni una cadena hex larga
const fugas = CASOS.map(([e]) => redactarUrl(e))
  .filter(u => /eyJ[A-Za-z0-9_-]{10,}/.test(u) || /\b[0-9a-f]{32,}\b/.test(u))
console.log('\nsalidas que aún contienen algo con forma de credencial:', fugas.length ? fugas : '(ninguna)')
if (fugas.length) fallos++

console.log('detección:', tieneParamSensible('/api/eventos?token=x') === true
  && tieneParamSensible('/health') === false ? 'OK' : '### FALLO')

console.log(fallos ? `\n${fallos} fallos` : '\nRedacción correcta en todos los casos')
process.exit(fallos ? 1 : 0)
