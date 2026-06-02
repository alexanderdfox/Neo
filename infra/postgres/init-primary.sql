-- Extensions and patterns you'll want before you need them at scale.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Example domain table: replace with your real schema.
CREATE TABLE IF NOT EXISTS app_events (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_events_kind_created_at_idx
  ON app_events (kind, created_at DESC);
