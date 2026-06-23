CREATE TABLE "service_database" (
	"serviceDatabaseId" text PRIMARY KEY NOT NULL,
	"composeId" text NOT NULL,
	"serviceName" text NOT NULL,
	"engine" "databaseEngine" NOT NULL,
	"image" text NOT NULL,
	"managed" text DEFAULT 'true' NOT NULL,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_database" ADD CONSTRAINT "service_database_composeId_compose_composeId_fk" FOREIGN KEY ("composeId") REFERENCES "public"."compose"("composeId") ON DELETE cascade ON UPDATE no action;