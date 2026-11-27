CREATE TABLE `memory` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`source_topic_id` text,
	`source_message_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `memory_updated_at_idx` ON `memory` (`updated_at`);