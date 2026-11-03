CREATE TABLE `source_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`event_id` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
