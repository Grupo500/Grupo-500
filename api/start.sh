#!/bin/sh
echo "🔄 Generando Prisma Client..."
prisma generate

echo "🔄 Ejecutando migraciones..."
DATABASE_URL="$DIRECT_URL" prisma migrate deploy

echo "🚀 Iniciando servidor..."
tsx src/index.ts
