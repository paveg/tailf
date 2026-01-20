-- Rename blogs table to feeds and update related columns
-- This migration handles SQLite limitations with foreign keys

-- Step 1: Create new feeds table with updated schema
CREATE TABLE `feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`feed_url` text NOT NULL,
	`site_url` text NOT NULL,
	`type` text DEFAULT 'blog' NOT NULL,
	`is_official` integer DEFAULT 0 NOT NULL,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Step 2: Copy data from blogs to feeds
INSERT INTO `feeds` (`id`, `title`, `description`, `feed_url`, `site_url`, `type`, `is_official`, `author_id`, `created_at`, `updated_at`)
SELECT `id`, `title`, `description`, `feed_url`, `site_url`, COALESCE(`type`, 'blog'), 0, `author_id`, `created_at`, `updated_at`
FROM `blogs`;
--> statement-breakpoint

-- Step 3: Create new posts table with feed_id
CREATE TABLE `posts_new` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`published_at` integer NOT NULL,
	`feed_id` text NOT NULL,
	`tech_score` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Step 4: Copy posts data
INSERT INTO `posts_new` (`id`, `title`, `summary`, `url`, `thumbnail_url`, `published_at`, `feed_id`, `tech_score`, `created_at`)
SELECT `id`, `title`, `summary`, `url`, `thumbnail_url`, `published_at`, `blog_id`, `tech_score`, `created_at`
FROM `posts`;
--> statement-breakpoint

-- Step 5: Create new follows table with feed_id
CREATE TABLE `follows_new` (
	`user_id` text NOT NULL,
	`feed_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `feed_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Step 6: Copy follows data
INSERT INTO `follows_new` (`user_id`, `feed_id`, `created_at`)
SELECT `user_id`, `blog_id`, `created_at`
FROM `follows`;
--> statement-breakpoint

-- Step 7: Drop old tables
DROP TABLE `follows`;
--> statement-breakpoint
DROP TABLE `posts`;
--> statement-breakpoint
DROP TABLE `blogs`;
--> statement-breakpoint

-- Step 8: Rename new tables
ALTER TABLE `posts_new` RENAME TO `posts`;
--> statement-breakpoint
ALTER TABLE `follows_new` RENAME TO `follows`;
--> statement-breakpoint

-- Step 9: Create indexes for feeds table
CREATE UNIQUE INDEX `feeds_feed_url_unique` ON `feeds` (`feed_url`);
--> statement-breakpoint
CREATE INDEX `feeds_author_id_idx` ON `feeds` (`author_id`);
--> statement-breakpoint
CREATE INDEX `feeds_type_idx` ON `feeds` (`type`);
--> statement-breakpoint

-- Step 10: Create indexes for posts table
CREATE UNIQUE INDEX `posts_url_unique` ON `posts` (`url`);
--> statement-breakpoint
CREATE INDEX `posts_feed_id_idx` ON `posts` (`feed_id`);
--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);
--> statement-breakpoint
CREATE INDEX `posts_tech_score_idx` ON `posts` (`tech_score`);
