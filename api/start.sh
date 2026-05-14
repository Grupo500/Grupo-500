#!/bin/sh
# Script de arranque para Railway
# Usa DIRECT_URL para la migración (evita P1002 en pooler de Neon)
# y DATABASE_URL (pooler) para el runtime de Express

echo "🔄 Ejecutando migraciones con conexión directa..."
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy

echo "🚀 Iniciando servidor..."
node dist/index.js
