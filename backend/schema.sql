-- Temple Clarity database schema (PostgreSQL 13+). Safe to run more than once.
-- Users live in Supabase Auth, so user_id columns hold the Supabase user UUID.
-- They intentionally have no foreign key, so this works on Supabase's own
-- Postgres or on a separate database (for example one hosted on Gcore).

CREATE TABLE IF NOT EXISTS activities (
  id          integer PRIMARY KEY,
  bucket      text    NOT NULL CHECK (bucket IN ('short', 'medium', 'long')),
  minutes     integer NOT NULL CHECK (minutes > 0),
  title       text    NOT NULL,
  description text    NOT NULL,
  genres      text[]  NOT NULL DEFAULT '{}',
  emotions    text[]  NOT NULL DEFAULT '{}',
  rank        integer NOT NULL DEFAULT 0,      -- lower shows first; the recommender can update this
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_bucket_idx ON activities (bucket) WHERE active;

CREATE TABLE IF NOT EXISTS reactions (
  user_id     uuid    NOT NULL,
  activity_id integer NOT NULL REFERENCES activities (id) ON DELETE CASCADE,
  fav         boolean NOT NULL DEFAULT false,
  vote        text    CHECK (vote IN ('up', 'down')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id),
  CHECK (fav OR vote IS NOT NULL)               -- rows with nothing set are deleted
);
CREATE INDEX IF NOT EXISTS reactions_activity_idx ON reactions (activity_id);

-- Which version of the Terms of Service each person agreed to, and when.
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,
  version     text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
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
-- Turning on row level security with no policies blocks that route. This API
-- connects with a database role that bypasses it, so the API is unaffected.
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs        ENABLE ROW LEVEL SECURITY;
