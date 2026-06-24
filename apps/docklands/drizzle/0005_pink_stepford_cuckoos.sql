CREATE TYPE "public"."ingressMode" AS ENUM('public', 'tunnel');--> statement-breakpoint
CREATE TABLE "cloudflare_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"apiToken" text NOT NULL,
	"accountId" text NOT NULL,
	"accountName" text,
	"zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tunnel" (
	"tunnelId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cfTunnelId" text NOT NULL,
	"token" text NOT NULL,
	"runtimeWorkerId" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "ingressMode" "ingressMode" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "tunnelId" text;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "cfDnsRecordId" text;--> statement-breakpoint
ALTER TABLE "webServerSettings" ADD COLUMN "defaultIngressMode" "ingressMode" DEFAULT 'public' NOT NULL;