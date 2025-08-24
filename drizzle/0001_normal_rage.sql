CREATE TABLE `presigned_urls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_key` text NOT NULL,
	`bucket_name` text NOT NULL,
	`url` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
