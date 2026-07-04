'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

// Paleta de marca (ver globals.css): azul, indigo, púrpura, cyan
const COLORES = ['#2094ff', '#4361ee', '#635cef', '#21b9f7']

function Forma({ posicion, geometria, color, velocidad }: {
  posicion: [number, number, number]
  geometria: 'icosahedron' | 'torus' | 'octahedron'
  color: string
  velocidad: number
}) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * velocidad * 0.3
    ref.current.rotation.y += delta * velocidad * 0.4
  })

  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={ref} position={posicion}>
        {geometria === 'icosahedron' && <icosahedronGeometry args={[1, 0]} />}
        {geometria === 'torus' && <torusGeometry args={[0.9, 0.32, 16, 48]} />}
        {geometria === 'octahedron' && <octahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.35} />
      </mesh>
    </Float>
  )
}

// mobile: menos formas y sin sparkles, para cuidar rendimiento y batería.
// pausado: detiene el render loop por completo (pestaña oculta), sin desmontar el canvas.
export function Hero3DScene({ liviano, pausado = false }: { liviano: boolean; pausado?: boolean }) {
  const formas = useMemo(() => [
    { posicion: [-2.4, 0.6, 0]  as [number, number, number], geometria: 'icosahedron' as const, color: COLORES[0], velocidad: 0.7 },
    { posicion: [2.2, -0.4, -1] as [number, number, number], geometria: 'torus'       as const, color: COLORES[1], velocidad: 0.5 },
    { posicion: [0.3, 1.1, -2]  as [number, number, number], geometria: 'octahedron'  as const, color: COLORES[2], velocidad: 0.9 },
    { posicion: [-1.1, -1.2, -1.5] as [number, number, number], geometria: 'icosahedron' as const, color: COLORES[3], velocidad: 0.6 },
  ], [])

  const visibles = liviano ? formas.slice(0, 2) : formas

  return (
    <Canvas
      dpr={[1, liviano ? 1.25 : 2]}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: !liviano, powerPreference: 'low-power', alpha: true }}
      frameloop={pausado ? 'never' : 'always'}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#95daff" />
      {visibles.map((f, i) => <Forma key={i} {...f} />)}
      {!liviano && <Sparkles count={40} scale={7} size={2} speed={0.3} color="#95daff" opacity={0.5} />}
    </Canvas>
  )
}
