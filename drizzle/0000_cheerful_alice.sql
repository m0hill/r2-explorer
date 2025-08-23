CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`account_id` text NOT NULL,
	`access_key_id` text NOT NULL,
	`secret_access_key_encrypted` blob NOT NULL
);
