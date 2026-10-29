-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `feed_bookmarks` (
	`user_id` text NOT NULL,
	`feed_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `feed_id`),
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`feed_url` text NOT NULL,
	`site_url` text NOT NULL,
	`type` text DEFAULT 'blog' NOT NULL,
	`is_official` integer DEFAULT false NOT NULL,
	`bookmark_count` integer DEFAULT 0 NOT NULL,
	`last_fetched_at` integer,
	`author_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feeds_bookmark_count_idx` ON `feeds` (`bookmark_count`);--> statement-breakpoint
CREATE INDEX `feeds_last_fetched_at_idx` ON `feeds` (`last_fetched_at`);--> statement-breakpoint
CREATE INDEX `feeds_type_idx` ON `feeds` (`type`);--> statement-breakpoint
CREATE INDEX `feeds_author_id_idx` ON `feeds` (`author_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_feed_url_unique` ON `feeds` (`feed_url`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`url` text NOT NULL,
	`thumbnail_url` text,
	`published_at` integer NOT NULL,
	`feed_id` text NOT NULL,
	`tech_score` real,
	`hatena_bookmark_count` integer,
	`main_topic` text,
	`sub_topic` text,
	`embedding` blob,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_sub_topic_idx` ON `posts` (`sub_topic`);--> statement-breakpoint
CREATE INDEX `posts_main_topic_idx` ON `posts` (`main_topic`);--> statement-breakpoint
CREATE INDEX `posts_hatena_bookmark_count_idx` ON `posts` (`hatena_bookmark_count`);--> statement-breakpoint
CREATE INDEX `posts_tech_score_idx` ON `posts` (`tech_score`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `posts_feed_id_idx` ON `posts` (`feed_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_url_unique` ON `posts` (`url`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);
*/