-- Add hatena bookmark count column to posts table
ALTER TABLE posts ADD COLUMN hatena_bookmark_count INTEGER;
--> statement-breakpoint
CREATE INDEX posts_hatena_bookmark_count_idx ON posts (hatena_bookmark_count);
