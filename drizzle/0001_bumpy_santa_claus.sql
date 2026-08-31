DROP INDEX "guardians_email_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_email_uq" ON "guardians" USING btree ("email");