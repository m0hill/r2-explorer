CREATE TABLE `folder_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` integer NOT NULL,
	`share_id` text NOT NULL,
	`bucket_name` text NOT NULL,
	`prefix` text NOT NULL,
	`url` text NOT NULL,
	`expires_at` text NOT NULL,
	`has_pin` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
