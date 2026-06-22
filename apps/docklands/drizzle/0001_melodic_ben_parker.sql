CREATE TABLE "member_resource_access" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "memberResourceAccess_member_resource_unique" UNIQUE("member_id","resource_type","resource_id")
);
--> statement-breakpoint
ALTER TABLE "member_resource_access" ADD CONSTRAINT "member_resource_access_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_resource_access" ADD CONSTRAINT "member_resource_access_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberResourceAccess_memberId_idx" ON "member_resource_access" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "memberResourceAccess_organizationId_idx" ON "member_resource_access" USING btree ("organization_id");--> statement-breakpoint
-- Backfill normalized access rows from the legacy member array columns before dropping them.
INSERT INTO "member_resource_access" ("id", "member_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid()::text, m."id", m."organization_id", 'workspace', r
FROM "member" m, unnest(m."accessedWorkspaces") AS r
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "member_resource_access" ("id", "member_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid()::text, m."id", m."organization_id", 'environment', r
FROM "member" m, unnest(m."accessedEnvironments") AS r
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "member_resource_access" ("id", "member_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid()::text, m."id", m."organization_id", 'service', r
FROM "member" m, unnest(m."accesedServices") AS r
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "member_resource_access" ("id", "member_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid()::text, m."id", m."organization_id", 'gitProvider', r
FROM "member" m, unnest(m."accessedGitProviders") AS r
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "member_resource_access" ("id", "member_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid()::text, m."id", m."organization_id", 'runtimeWorker', r
FROM "member" m, unnest(m."accessedRuntimeWorkers") AS r
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "accessedWorkspaces";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "accessedEnvironments";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "accesedServices";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "accessedGitProviders";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "accessedRuntimeWorkers";