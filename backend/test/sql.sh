#!/bin/sh
# Checks schema.sql, schema_additions.sql, seed.sql and every query in src/queries.js against a real Postgres.
# Usage: DATABASE_URL=postgresql://... npm run test:sql
# Use an EMPTY scratch database: schema.sql can only be loaded once into a database.
set -e
: "${DATABASE_URL:?Set DATABASE_URL to an empty scratch database}"
cd "$(dirname "$0")/.."
P="psql $DATABASE_URL -v ON_ERROR_STOP=1 -q -X"

$P -f schema.sql -f schema_additions.sql
$P -f seed.sql
COUNTS=$($P -Atc "SELECT (SELECT count(*) FROM activity_genres) || ',' || (SELECT count(*) FROM activity_emotions)")
$P -f seed.sql                                  # re-running the seed must not add anything
[ "$COUNTS" = "$($P -Atc "SELECT (SELECT count(*) FROM activity_genres) || ',' || (SELECT count(*) FROM activity_emotions)")" ] \
  || { echo "FAIL: running seed.sql twice created duplicates"; exit 1; }

node scripts/gen-sql.mjs "22222222-2222-2222-2222-222222222222" > /tmp/tc-sql-test.sql
$P -o /dev/null -f /tmp/tc-sql-test.sql

# The users table can't be created without a profile row first
if $P -c "INSERT INTO users (email, password_hash) VALUES ('x@y.co', 'h')" 2>/dev/null; then echo "FAIL: user without a profile was accepted"; exit 1; fi
$P -c "DELETE FROM error_logs WHERE source = 'audio'"
rm -f /tmp/tc-sql-test.sql
echo "SQL checks passed"
