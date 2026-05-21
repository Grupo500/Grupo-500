-- Migración: Clerk → NextAuth
-- 1. Agregar nuevos campos al User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerified"  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "hashedPassword" TEXT;

-- 2. Eliminar constraint unique de clerkId y la columna
ALTER TABLE "User" DROP COLUMN IF EXISTS "clerkId";

-- 3. Tabla Account (OAuth providers)
CREATE TABLE IF NOT EXISTS "Account" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE ("provider", "providerAccountId"),
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 4. Tabla Session
CREATE TABLE IF NOT EXISTS "Session" (
  "id"           TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "expires"      TIMESTAMP NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_sessionToken_key" UNIQUE ("sessionToken"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 5. Tabla VerificationToken
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expires"    TIMESTAMP NOT NULL,
  CONSTRAINT "VerificationToken_token_key" UNIQUE ("token"),
  CONSTRAINT "VerificationToken_identifier_token_key" UNIQUE ("identifier", "token")
);
