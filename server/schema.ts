export const schema = `
CREATE TABLE IF NOT EXISTS compositions (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  delete_hash TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);
CREATE INDEX IF NOT EXISTS compositions_expiry ON compositions(expires_at);
CREATE TABLE IF NOT EXISTS request_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL
);
`
