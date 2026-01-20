ALTER TABLE `blogs` ADD `type` text DEFAULT 'blog' NOT NULL;--> statement-breakpoint
CREATE INDEX `blogs_type_idx` ON `blogs` (`type`);