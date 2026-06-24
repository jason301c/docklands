ALTER TABLE "schedule" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "schedule" CASCADE;--> statement-breakpoint
ALTER TABLE "deployment" DROP CONSTRAINT "deployment_scheduleId_schedule_scheduleId_fk";
--> statement-breakpoint
ALTER TABLE "deployment" DROP COLUMN "scheduleId";--> statement-breakpoint
DROP TYPE "public"."scheduleType";--> statement-breakpoint
DROP TYPE "public"."shellType";