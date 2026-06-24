CREATE TABLE "workspace_service_group" (
	"groupId" text PRIMARY KEY NOT NULL,
	"environmentId" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer DEFAULT 420 NOT NULL,
	"height" integer DEFAULT 320 NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_service_layout" ADD COLUMN "groupId" text;--> statement-breakpoint
ALTER TABLE "workspace_service_group" ADD CONSTRAINT "workspace_service_group_environmentId_environment_environmentId_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("environmentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_service_layout" ADD CONSTRAINT "workspace_service_layout_groupId_workspace_service_group_groupId_fk" FOREIGN KEY ("groupId") REFERENCES "public"."workspace_service_group"("groupId") ON DELETE set null ON UPDATE no action;