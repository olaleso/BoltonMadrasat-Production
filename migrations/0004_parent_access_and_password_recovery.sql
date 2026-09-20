CREATE TABLE IF NOT EXISTS `password_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `password_access_tokens_hash_uq` ON `password_access_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `password_access_tokens_user_expiry_idx` ON `password_access_tokens` (`user_id`,`expires_at`);
