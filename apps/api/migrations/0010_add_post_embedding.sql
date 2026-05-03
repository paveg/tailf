-- Add embedding column to posts table for semantic search
-- L2-normalized BGE-M3 vectors (1024-dim float32, 4096 bytes/row)
-- NULL until backfilled (see semantic search PR #2)
ALTER TABLE posts ADD COLUMN embedding BLOB;
