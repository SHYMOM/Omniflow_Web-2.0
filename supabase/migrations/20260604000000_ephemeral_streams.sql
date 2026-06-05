CREATE TABLE ephemeral_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id TEXT NOT NULL,
    episode_key TEXT NOT NULL,
    stream_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE UNIQUE INDEX idx_ephemeral_streams_lookup ON ephemeral_streams(media_id, episode_key);
