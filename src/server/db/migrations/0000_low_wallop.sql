CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`reason` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `leave_requests_user_status_idx` ON `leave_requests` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `leave_requests_status_idx` ON `leave_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `leave_requests_dates_idx` ON `leave_requests` (`user_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `password_resets_user_idx` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`work_date` text NOT NULL,
	`kind` text DEFAULT 'work' NOT NULL,
	`morning_start` text,
	`morning_end` text,
	`afternoon_start` text,
	`afternoon_end` text,
	`morning_on_leave` integer DEFAULT false NOT NULL,
	`afternoon_on_leave` integer DEFAULT false NOT NULL,
	`use_104` integer DEFAULT false NOT NULL,
	`hours_104_override` real,
	`regular_hours` real DEFAULT 0 NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`leave_hours` real DEFAULT 0 NOT NULL,
	`leave_104_hours` real DEFAULT 0 NOT NULL,
	`vacation_hours` real DEFAULT 0 NOT NULL,
	`sickness_hours` real DEFAULT 0 NOT NULL,
	`paternity_hours` real DEFAULT 0 NOT NULL,
	`notes` text,
	`medical_certificate` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `time_entries_user_date_idx` ON `time_entries` (`user_id`,`work_date`);--> statement-breakpoint
CREATE INDEX `time_entries_date_idx` ON `time_entries` (`work_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'EMPLOYEE' NOT NULL,
	`can_work_sunday` integer DEFAULT false NOT NULL,
	`has_104` integer DEFAULT false NOT NULL,
	`has_paternity` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_schedules` (
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`is_working` integer DEFAULT true NOT NULL,
	`morning_start` text,
	`morning_end` text,
	`afternoon_start` text,
	`afternoon_end` text,
	`contract_hours` real DEFAULT 0 NOT NULL,
	`manual_hours` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `weekday`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
