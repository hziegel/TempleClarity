#!/bin/sh
# Checks schema.sql, schema_additions.sql, seed.sql and every query in src/queries.js against a real Postgres.
# Usage: DATABASE_URL=postgresql://... npm run test:sql
# Use a scratch database: schema.sql starts with DROP SCHEMA public CASCADE, so it erases everything in it.
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

# Rules the database itself enforces
if $P -c "INSERT INTO user_profiles (user_id) VALUES (999999)" 2>/dev/null; then echo "FAIL: profile without a user was accepted"; exit 1; fi
$P -c "INSERT INTO users (id, email, password_hash) VALUES (900, 'x@y.co', 'h')"
$P -c "INSERT INTO favorites (user_id, activity_id) VALUES (900, 1)"
if $P -c "INSERT INTO favorites (user_id, activity_id) VALUES (900, 1)" 2>/dev/null; then echo "FAIL: duplicate favorite was accepted"; exit 1; fi
$P -c "DELETE FROM favorites WHERE user_id = 900; DELETE FROM users WHERE id = 900"
$P -c "DELETE FROM error_logs WHERE source = 'audio'"
rm -f /tmp/tc-sql-test.sql
echo "SQL checks passed"
