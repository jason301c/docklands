DROP TABLE "forward_auth_settings" CASCADE;--> statement-breakpoint
DROP TABLE "sso_provider" CASCADE;--> statement-breakpoint
ALTER TABLE "domain" DROP COLUMN "forwardAuthEnabled";--> statement-breakpoint
ALTER TABLE "webServerSettings" DROP COLUMN "enforceSSO";