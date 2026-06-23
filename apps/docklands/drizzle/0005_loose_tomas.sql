ALTER TABLE "libsql" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mariadb" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mongo" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mysql" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "postgres" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "redis" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "libsql" CASCADE;--> statement-breakpoint
DROP TABLE "mariadb" CASCADE;--> statement-breakpoint
DROP TABLE "mongo" CASCADE;--> statement-breakpoint
DROP TABLE "mysql" CASCADE;--> statement-breakpoint
DROP TABLE "postgres" CASCADE;--> statement-breakpoint
DROP TABLE "redis" CASCADE;--> statement-breakpoint
ALTER TABLE "backup" DROP CONSTRAINT "backup_postgresId_postgres_postgresId_fk";
--> statement-breakpoint
ALTER TABLE "backup" DROP CONSTRAINT "backup_mariadbId_mariadb_mariadbId_fk";
--> statement-breakpoint
ALTER TABLE "backup" DROP CONSTRAINT "backup_mysqlId_mysql_mysqlId_fk";
--> statement-breakpoint
ALTER TABLE "backup" DROP CONSTRAINT "backup_mongoId_mongo_mongoId_fk";
--> statement-breakpoint
ALTER TABLE "backup" DROP CONSTRAINT "backup_libsqlId_libsql_libsqlId_fk";
--> statement-breakpoint
ALTER TABLE "mount" DROP CONSTRAINT "mount_libsqlId_libsql_libsqlId_fk";
--> statement-breakpoint
ALTER TABLE "mount" DROP CONSTRAINT "mount_mariadbId_mariadb_mariadbId_fk";
--> statement-breakpoint
ALTER TABLE "mount" DROP CONSTRAINT "mount_mongoId_mongo_mongoId_fk";
--> statement-breakpoint
ALTER TABLE "mount" DROP CONSTRAINT "mount_mysqlId_mysql_mysqlId_fk";
--> statement-breakpoint
ALTER TABLE "mount" DROP CONSTRAINT "mount_postgresId_postgres_postgresId_fk";
--> statement-breakpoint
ALTER TABLE "mount" DROP CONSTRAINT "mount_redisId_redis_redisId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" DROP CONSTRAINT "volume_backup_postgresId_postgres_postgresId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" DROP CONSTRAINT "volume_backup_mariadbId_mariadb_mariadbId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" DROP CONSTRAINT "volume_backup_mongoId_mongo_mongoId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" DROP CONSTRAINT "volume_backup_mysqlId_mysql_mysqlId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" DROP CONSTRAINT "volume_backup_redisId_redis_redisId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" DROP CONSTRAINT "volume_backup_libsqlId_libsql_libsqlId_fk";
--> statement-breakpoint
ALTER TABLE "volume_backup" ADD COLUMN "databaseId" text;--> statement-breakpoint
ALTER TABLE "volume_backup" ADD CONSTRAINT "volume_backup_databaseId_database_databaseId_fk" FOREIGN KEY ("databaseId") REFERENCES "public"."database"("databaseId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup" DROP COLUMN "postgresId";--> statement-breakpoint
ALTER TABLE "backup" DROP COLUMN "mariadbId";--> statement-breakpoint
ALTER TABLE "backup" DROP COLUMN "mysqlId";--> statement-breakpoint
ALTER TABLE "backup" DROP COLUMN "mongoId";--> statement-breakpoint
ALTER TABLE "backup" DROP COLUMN "libsqlId";--> statement-breakpoint
ALTER TABLE "mount" DROP COLUMN "libsqlId";--> statement-breakpoint
ALTER TABLE "mount" DROP COLUMN "mariadbId";--> statement-breakpoint
ALTER TABLE "mount" DROP COLUMN "mongoId";--> statement-breakpoint
ALTER TABLE "mount" DROP COLUMN "mysqlId";--> statement-breakpoint
ALTER TABLE "mount" DROP COLUMN "postgresId";--> statement-breakpoint
ALTER TABLE "mount" DROP COLUMN "redisId";--> statement-breakpoint
ALTER TABLE "volume_backup" DROP COLUMN "postgresId";--> statement-breakpoint
ALTER TABLE "volume_backup" DROP COLUMN "mariadbId";--> statement-breakpoint
ALTER TABLE "volume_backup" DROP COLUMN "mongoId";--> statement-breakpoint
ALTER TABLE "volume_backup" DROP COLUMN "mysqlId";--> statement-breakpoint
ALTER TABLE "volume_backup" DROP COLUMN "redisId";--> statement-breakpoint
ALTER TABLE "volume_backup" DROP COLUMN "libsqlId";