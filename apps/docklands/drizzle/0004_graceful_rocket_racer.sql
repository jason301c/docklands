ALTER TABLE IF EXISTS "schedule" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "schedule" CASCADE;--> statement-breakpoint
ALTER TABLE "deployment" DROP CONSTRAINT IF EXISTS "deployment_scheduleId_schedule_scheduleId_fk";
--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN IF EXISTS "scheduleId";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."scheduleType";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."shellType";
