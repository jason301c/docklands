CREATE TYPE "public"."databaseEngine" AS ENUM('postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'libsql');--> statement-breakpoint
CREATE TABLE "database" (
	"databaseId" text PRIMARY KEY NOT NULL,
	"engine" "databaseEngine" NOT NULL,
	"name" text NOT NULL,
	"appName" text NOT NULL,
	"description" text,
	"config" json NOT NULL,
	"dockerImage" text NOT NULL,
	"command" text,
	"args" text[],
	"env" text,
	"memoryReservation" text,
	"externalPort" integer,
	"memoryLimit" text,
	"cpuReservation" text,
	"cpuLimit" text,
	"applicationStatus" "applicationStatus" DEFAULT 'idle' NOT NULL,
	"healthCheckSwarm" json,
	"restartPolicySwarm" json,
	"placementSwarm" json,
	"updateConfigSwarm" json,
	"rollbackConfigSwarm" json,
	"modeSwarm" json,
	"labelsSwarm" json,
	"networkSwarm" json,
	"stopGracePeriodSwarm" bigint,
	"endpointSpecSwarm" json,
	"ulimitsSwarm" json,
	"replicas" integer DEFAULT 1 NOT NULL,
	"createdAt" text NOT NULL,
	"environmentId" text NOT NULL,
	"runtimeWorkerId" text,
	CONSTRAINT "database_appName_unique" UNIQUE("appName")
);
--> statement-breakpoint
ALTER TABLE "backup" ADD COLUMN "databaseId" text;--> statement-breakpoint
ALTER TABLE "mount" ADD COLUMN "databaseId" text;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_environmentId_environment_environmentId_fk" FOREIGN KEY ("environmentId") REFERENCES "public"."environment"("environmentId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database" ADD CONSTRAINT "database_runtimeWorkerId_runtimeWorker_runtimeWorkerId_fk" FOREIGN KEY ("runtimeWorkerId") REFERENCES "public"."runtimeWorker"("runtimeWorkerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup" ADD CONSTRAINT "backup_databaseId_database_databaseId_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("databaseId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mount" ADD CONSTRAINT "mount_databaseId_database_databaseId_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("databaseId") ON DELETE cascade ON UPDATE no action;