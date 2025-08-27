ALTER TABLE `connections` ADD `api_token_encrypted` blob;--> statement-breakpoint
ALTER TABLE `connections` ADD `worker_name` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `worker_subdomain` text;