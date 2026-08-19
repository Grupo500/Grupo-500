# Migración de contabilidad: roles, trazabilidad y nómina fija

**Escrita y probada por Cristal el 18-ago-2026. La aplica David.**

## Qué hace

Todo aditivo. No hay `DROP`, `TRUNCATE` ni cambios sobre columnas existentes:

- `Role` gana el valor `COFUNDADOR`.
- `contab_registros` gana `motivo_rechazo` y `valor_original` (ambas nulas).
- `contab_departamentos` gana `archivado` (por defecto `false`).
- Tablas nuevas: `contab_lideres` y `contab_nomina`.

## El orden importa: primero esto, después el código

Prisma pide en cada consulta todas las columnas del modelo, también las que el
código no usa. Se comprobó contra una base sin migrar: cualquier consulta de
`contab_registros` responde *"The column contab_registros.motivo_rechazo does
not exist"*. Es decir que **si el `schema.prisma` llega a producción antes que
esta migración, el módulo de contabilidad se cae entero**, aunque nadie haya
tocado una función.

Por eso el código vive en la rama `esquema-contabilidad-roles-nomina` y no se
mezcla a `main` hasta que esta migración esté aplicada.

## Cómo aplicarla

Con las variables públicas del servicio Postgres exportadas:

    railway variables --service Postgres --kv     # tomar DATABASE_PUBLIC_URL
    export DATABASE_URL="<esa url>"; export DIRECT_URL="$DATABASE_URL"

Si la base ya tiene su tabla `_prisma_migrations`:

    npx prisma migrate deploy

Si sigue sin ella y responde P3005 (quedó así tras el borrado del 18-ago):

    npx prisma db execute --file prisma/migrations/20260819015847_contabilidad_roles_nomina/migration.sql --schema prisma/schema.prisma

## Comprobar que quedó

    select unnest(enum_range(null::"Role"));                  -- debe incluir COFUNDADOR
    \d contab_registros                                        -- motivo_rechazo, valor_original
    select count(*) from contab_lideres;                       -- 0, pero la tabla existe
    select count(*) from contab_registros;                     -- igual que antes de aplicar

Nada de esto borra datos: si el conteo de `contab_registros` cambia, algo salió
mal y hay que parar.
