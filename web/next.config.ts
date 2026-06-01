import type { NextConfig } from 'next'

const securityHeaders = [
  // Evita que la app sea embebida en iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Evita que el browser "adivine" el content-type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Controla cuánta info de referrer se envía
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Fuerza HTTPS por 1 año (solo en producción lo respetan browsers)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Permisos de APIs del browser — deshabilita las que no usamos
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: solo mismo origen + Next.js inline necesario
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Estilos: mismo origen + inline (Tailwind lo requiere)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fuentes: Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Imágenes: mismo origen + Cloudinary + Google OAuth avatars + data URIs
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://img.clerk.com https://purecatamphetamine.github.io https://flagcdn.com",
      // Conexiones: mismo origen + API + Google OAuth + Next-Auth
      "connect-src 'self' https://api-production-79572.up.railway.app https://accounts.google.com https://oauth2.googleapis.com",
      // Frames: Google OAuth + mismo origen (para el proxy PDF)
      "frame-src 'self' https://accounts.google.com",
      // Form action: permite redirección a Google OAuth
      "form-action 'self' https://accounts.google.com",
      // Workers: mismo origen (PWA service worker)
      "worker-src 'self' blob:",
      // Manifest PWA
      "manifest-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Proxy PDF: permitir embedding en iframe desde el mismo origen
        source: '/api/pdf-proxy',
        headers: [
          { key: 'X-Frame-Options',              value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy',       value: "default-src 'none'" },
          { key: 'Cache-Control',                 value: 'public, max-age=3600' },
        ],
      },
      {
        // Service Worker: no cachear para que siempre se sirva la versión más reciente
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Manifest: MIME correcto + sin caché agresiva
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
