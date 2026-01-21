-- Add bookmark_count column to feeds table
ALTER TABLE feeds ADD COLUMN bookmark_count INTEGER NOT NULL DEFAULT 0;

-- Update existing counts from feed_bookmarks table
UPDATE feeds SET bookmark_count = (
  SELECT COUNT(*) FROM feed_bookmarks WHERE feed_bookmarks.feed_id = feeds.id
);

-- Create index for sorting by bookmark_count
CREATE INDEX feeds_bookmark_count_idx ON feeds(bookmark_count);
