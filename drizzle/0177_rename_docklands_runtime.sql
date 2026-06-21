DO $$
DECLARE
	legacy_restart_column text := 'dok' || 'ployRestart';
	legacy_backup_column text := 'dok' || 'ployBackup';
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'notification'
			AND column_name = legacy_restart_column
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'notification'
			AND column_name = 'docklandsRestart'
	) THEN
		EXECUTE format(
			'ALTER TABLE "notification" RENAME COLUMN %I TO "docklandsRestart"',
			legacy_restart_column
		);
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'notification'
			AND column_name = legacy_backup_column
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'notification'
			AND column_name = 'docklandsBackup'
	) THEN
		EXECUTE format(
			'ALTER TABLE "notification" RENAME COLUMN %I TO "docklandsBackup"',
			legacy_backup_column
		);
	END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
	legacy_schedule_type text := 'dok' || 'ploy-server';
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'scheduleType'
			AND e.enumlabel = legacy_schedule_type
	) AND NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'scheduleType'
			AND e.enumlabel = 'docklands-server'
	) THEN
		EXECUTE format(
			'ALTER TYPE "public"."scheduleType" RENAME VALUE %L TO %L',
			legacy_schedule_type,
			'docklands-server'
		);
	END IF;
END $$;
