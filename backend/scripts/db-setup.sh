#!/bin/sh
# Loads schema.sql, schema_additions.sql and seed.sql.
# schema.sql begins with DROP SCHEMA public CASCADE, which erases every table in the database,
# so this refuses to run on a database that already has tables unless you add --wipe:
#   npm run db:setup              (empty database)
#   npm run db:setup -- --wipe    (erase and rebuild)
set -e
: "${DATABASE_URL:?Set DATABASE_URL first}"
cd "$(dirname "$0")/.."
TABLES=$(psql "$DATABASE_URL" -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
if [ "$TABLES" != "0" ] && [ "$1" != "--wipe" ]; then
  echo "Refusing to continue: the public schema already has $TABLES tables, and schema.sql would erase them."
  echo "If that is what you want, run:  npm run db:setup -- --wipe"
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f schema.sql -f schema_additions.sql -f seed.sql
echo "Database ready."
