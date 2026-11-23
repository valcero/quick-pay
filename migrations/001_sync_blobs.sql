-- Optional encrypted sync. The only table. No users, no emails, no payment identifiers.
-- `id` is a random 128-bit capability token generated on-device (hex, 32 chars).
-- `data` is ciphertext ("qp1.<base64>") sealed with a key the server never receives.
CREATE TABLE IF NOT EXISTS sync_blobs (
    id         TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{32}$'),
    data       TEXT        NOT NULL CHECK (length(data) <= 65536 AND data LIKE 'qp1.%'),
    version    BIGINT      NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_blobs_updated_at_idx ON sync_blobs (updated_at);
-- Retention: purge blobs idle for 180 days (run daily from cron/pg_cron).
-- DELETE FROM sync_blobs WHERE updated_at < now() - interval '180 days';
