ALTER TABLE "guest_codes" ADD COLUMN "salt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_codes" ADD COLUMN "offline_hash" text DEFAULT '' NOT NULL;