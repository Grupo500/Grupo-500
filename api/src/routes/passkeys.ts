import { Router } from 'express'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { prisma } from '../config/prisma'
import { SignJWT } from 'jose'

const router = Router()

// Dominio y origen según entorno
const RP_ID     = process.env.WEBAUTHN_RP_ID     ?? 'localhost'
const RP_NAME   = process.env.WEBAUTHN_RP_NAME   ?? 'Grupo 500'
const ORIGIN    = process.env.WEBAUTHN_ORIGIN    ?? 'http://localhost:3000'

// Almacén temporal de challenges (en producción usa Redis)
const challengeStore = new Map<string, string>()

// ── Listar passkeys del usuario ───────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const passkeys = await prisma.passkey.findMany({
    where: { userId: req.userId! },
    select: { id: true, name: true, deviceType: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return ApiResponse.success(res, passkeys)
}))

// ── Eliminar passkey ──────────────────────────────────────────────────────────
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const passkey = await prisma.passkey.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  })
  if (!passkey) return res.status(404).json({ error: 'Passkey no encontrada' })

  await prisma.passkey.delete({ where: { id: passkey.id } })
  return ApiResponse.success(res, { deleted: true })
}))

// ── Registro: generar opciones ────────────────────────────────────────────────
router.post('/register/start', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { passkeys: true },
  })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  const options = await generateRegistrationOptions({
    rpName:  RP_NAME,
    rpID:    RP_ID,
    userID:  Buffer.from(user.id),
    userName: user.email,
    userDisplayName: user.nombre ?? user.email,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map(pk => ({
      id: pk.credentialId,
      transports: pk.transports as any,
    })),
    authenticatorSelection: {
      residentKey:        'preferred',
      userVerification:   'preferred',
      authenticatorAttachment: 'platform', // Face ID / Touch ID
    },
  })

  challengeStore.set(user.id, options.challenge)
  return ApiResponse.success(res, options)
}))

// ── Registro: verificar y guardar ─────────────────────────────────────────────
router.post('/register/finish', authenticate, asyncHandler(async (req, res) => {
  const body = req.body as any & { name?: string }
  const expectedChallenge = challengeStore.get(req.userId!)
  if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expirado' })

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID:   RP_ID,
  })

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Verificación fallida' })
  }

  const { credential } = verification.registrationInfo

  await prisma.passkey.create({
    data: {
      userId:       req.userId!,
      credentialId: credential.id,
      publicKey:    Buffer.from(credential.publicKey),
      counter:      BigInt(credential.counter),
      deviceType:   verification.registrationInfo.credentialDeviceType,
      backedUp:     verification.registrationInfo.credentialBackedUp,
      transports:   body.response.transports ?? [],
      name:         body.name ?? 'Dispositivo',
    },
  })

  challengeStore.delete(req.userId!)
  return ApiResponse.success(res, { verified: true })
}))

// ── Autenticación: generar opciones (sin sesión requerida) ────────────────────
router.post('/auth/start', asyncHandler(async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  const user = await prisma.user.findUnique({
    where: { email },
    include: { passkeys: true },
  })
  if (!user || user.passkeys.length === 0) {
    return res.status(404).json({ error: 'Sin passkeys registradas para este usuario' })
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.passkeys.map(pk => ({
      id: pk.credentialId,
      transports: pk.transports as any,
    })),
    userVerification: 'preferred',
  })

  challengeStore.set(user.id, options.challenge)
  return ApiResponse.success(res, { ...options, userId: user.id })
}))

// ── Autenticación: verificar y emitir JWT ─────────────────────────────────────
router.post('/auth/finish', asyncHandler(async (req, res) => {
  const body: any & { userId: string } = req.body
  if (!body.userId) return res.status(400).json({ error: 'userId requerido' })

  const user = await prisma.user.findUnique({
    where: { id: body.userId },
    include: { passkeys: true },
  })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  const passkey = user.passkeys.find(pk => pk.credentialId === body.id)
  if (!passkey) return res.status(400).json({ error: 'Passkey no encontrada' })

  const expectedChallenge = challengeStore.get(user.id)
  if (!expectedChallenge) return res.status(400).json({ error: 'Challenge expirado' })

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID:   RP_ID,
    credential: {
      id:        passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter:   Number(passkey.counter),
      transports: passkey.transports as any,
    },
  })

  if (!verification.verified) {
    return res.status(400).json({ error: 'Verificación fallida' })
  }

  // Actualizar counter
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter:    BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  })

  challengeStore.delete(user.id)

  // Emitir JWT de sesión (igual que el endpoint /api/auth/token del frontend)
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
  const token = await new SignJWT({
    sub:   user.id,
    email: user.email,
    role:  user.role,
    name:  user.nombre ?? user.email,
    image: user.image,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)

  return ApiResponse.success(res, { verified: true, token, user: {
    id:    user.id,
    email: user.email,
    name:  user.nombre,
    role:  user.role,
    image: user.image,
  }})
}))

export default router
