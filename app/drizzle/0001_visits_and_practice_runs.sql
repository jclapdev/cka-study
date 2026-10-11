CREATE TABLE `practice_run` (
	`topic` text PRIMARY KEY NOT NULL,
	`startedAt` text,
	`endedAt` text,
	`results` text NOT NULL,
	`passed` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visit` (
	`topic` text NOT NULL,
	`lesson` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY(`topic`, `lesson`)
);
