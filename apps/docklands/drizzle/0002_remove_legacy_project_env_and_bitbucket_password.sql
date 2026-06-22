UPDATE "project" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "environment" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "application" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "application" SET "previewEnv" = replace("previewEnv", '${{project.', '${{workspace.') WHERE "previewEnv" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "compose" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "libsql" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "mariadb" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "mongo" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "mysql" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "postgres" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
UPDATE "redis" SET "env" = replace("env", '${{project.', '${{workspace.') WHERE "env" LIKE '%${{project.%';--> statement-breakpoint
ALTER TABLE "bitbucket" DROP COLUMN "appPassword";
