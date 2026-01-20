ALTER TABLE `posts` ADD `tech_score` real;--> statement-breakpoint
CREATE INDEX `posts_tech_score_idx` ON `posts` (`tech_score`);