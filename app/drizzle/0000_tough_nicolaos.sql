CREATE TABLE `attempt` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`startedAt` text NOT NULL,
	`seconds` integer NOT NULL,
	`budgetSeconds` integer,
	`passed` text NOT NULL,
	`score` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mark` (
	`topic` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updatedAt` text NOT NULL,
	PRIMARY KEY(`topic`, `kind`, `key`)
);
--> statement-breakpoint
CREATE TABLE `note` (
	`topic` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`updatedAt` text NOT NULL
);
