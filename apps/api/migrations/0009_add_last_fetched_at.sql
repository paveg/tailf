-- Add last_fetched_at column to feeds table for RSS fetch priority ordering
ALTER TABLE feeds ADD COLUMN last_fetched_at INTEGER;

-- Create index for efficient ordering by last_fetched_at
CREATE INDEX IF NOT EXISTS feeds_last_fetched_at_idx ON feeds (last_fetched_at);
