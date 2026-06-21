CREATE TYPE "public"."workspaceServiceType" AS ENUM('application', 'compose', 'libsql', 'mariadb', 'mongo', 'mysql', 'postgres', 'redis');--> statement-breakpoint
CREATE TABLE "workspace_service_connection" (
	"connectionId" text PRIMARY KEY NOT NULL,
	"environmentId" text NOT NULL,
	"sourceServiceType" "workspaceServiceType" NOT NULL,
	"sourceServiceId" text NOT NULL,
	"targetServiceType" "workspaceServiceType" NOT NULL,
	"targetServiceId" text NOT NULL,
	"label" text,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "unique_workspace_service_connection" UNIQUE("environmentId","sourceServiceType","sourceServiceId","targetServiceType","targetServiceId")
);
--> statement-breakpoint
CREATE TABLE "workspace_service_layout" (
	"layoutId" text PRIMARY KEY NOT NULL,
	"environmentId" text NOT NULL,
	"serviceType" "workspaceServiceType" NOT NULL,
	"serviceId" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer DEFAULT 280 NOT NULL,
	"height" integer DEFAULT 164 NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL,
	CONSTRAINT "unique_workspace_service_layout" UNIQUE("environmentId","serviceType","serviceId")
);
--> statement-breakpoint
ALTER TABLE "workspace_service_connection" ADD CONSTRAINT "workspace_service_connection_environmentId_environment_environmentId_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("environmentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_service_layout" ADD CONSTRAINT "workspace_service_layout_environmentId_environment_environmentId_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("environmentId") ON DELETE cascade ON UPDATE no action;