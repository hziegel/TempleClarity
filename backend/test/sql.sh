#!/bin/sh
# Checks schema.sql, seed.sql and every query in src/queries.js against a real Postgres.
# Usage: DATABASE_URL=postgresql://... npm run test:sql   (needs psql; use a scratch database)
set -e
: "${DATABASE_URL:?Set DATABASE_URL to a scratch database}"
cd "$(dirname "$0")/.."
P="psql $DATABASE_URL -v ON_ERROR_STOP=1 -q -X"

# Schema and seed twice: they must be safe to re-run.
$P -f schema.sql -f schema.sql -f seed.sql -f seed.sql

U='11111111-1111-1111-1111-111111111111'
node scripts/gen-sql.mjs "$U" > /tmp/tc-sql-test.sql
$P -o /dev/null -f /tmp/tc-sql-test.sql

# Rules the database itself enforces
if $P -c "INSERT INTO reactions (user_id, activity_id, fav, vote) VALUES ('$U', 1, false, NULL)" 2>/dev/null; then echo "FAIL: empty reaction was accepted"; exit 1; fi
if $P -c "INSERT INTO activities (id, bucket, minutes, title, description) VALUES (99, 'huge', 5, 'x', 'y')" 2>/dev/null; then echo "FAIL: bad bucket was accepted"; exit 1; fi
$P -c "INSERT INTO reactions (user_id, activity_id, fav, vote) VALUES ('$U', 3, true, NULL); DELETE FROM reactions WHERE user_id = '$U'"
$P -c "DELETE FROM error_logs WHERE source = 'audio'"
echo "SQL checks passed"
