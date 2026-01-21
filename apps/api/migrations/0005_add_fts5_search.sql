-- FTS5 full-text search for posts
-- Using trigram tokenizer for Japanese language support

-- Create FTS5 virtual table (external content table referencing posts)
CREATE VIRTUAL TABLE posts_fts USING fts5(
  title,
  summary,
  content='posts',
  content_rowid='rowid',
  tokenize='trigram'
);
--> statement-breakpoint

-- Populate FTS table with existing data
INSERT INTO posts_fts(rowid, title, summary)
SELECT rowid, title, COALESCE(summary, '') FROM posts;
--> statement-breakpoint

-- Trigger: sync on INSERT
CREATE TRIGGER posts_fts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, summary)
  VALUES (new.rowid, new.title, COALESCE(new.summary, ''));
END;
--> statement-breakpoint

-- Trigger: sync on UPDATE
CREATE TRIGGER posts_fts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, summary)
  VALUES('delete', old.rowid, old.title, COALESCE(old.summary, ''));
  INSERT INTO posts_fts(rowid, title, summary)
  VALUES (new.rowid, new.title, COALESCE(new.summary, ''));
END;
--> statement-breakpoint

-- Trigger: sync on DELETE
CREATE TRIGGER posts_fts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, summary)
  VALUES('delete', old.rowid, old.title, COALESCE(old.summary, ''));
END;
