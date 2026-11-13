-- Extra tables the API needs. Run after schema.sql. Nothing in schema.sql is changed.

-- Links a Supabase Auth user (uuid) to a row in your users table (integer id).
-- The row in users is created the first time someone signs in. Supabase owns the
-- real password, so users.password_hash holds the placeholder '!supabase', which
-- is not a valid hash and can never match a login.
CREATE TABLE IF NOT EXISTS supabase_users (
  supabase_user_id uuid PRIMARY KEY,
  user_id          integer NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE
);

-- Errors reported by the front end. Contains no user text, emails or tokens.
CREATE TABLE IF NOT EXISTS error_logs (
  id          bigserial PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  client_time timestamptz,
  level       text NOT NULL CHECK (level IN ('error', 'warn')),
  source      text NOT NULL,
  message     text NOT NULL,
  context     jsonb NOT NULL DEFAULT '{}',
  stack       text NOT NULL DEFAULT '',
  route       text NOT NULL DEFAULT '',
  count       integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS error_logs_received_idx ON error_logs (received_at DESC);

-- On Supabase, tables are reachable through its public REST API by default.
-- Row level security with no policies blocks that route. This API connects with a
-- database role that bypasses it, so the API is unaffected.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
