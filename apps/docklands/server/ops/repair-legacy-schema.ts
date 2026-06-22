import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Sql } from "postgres";

type JournalEntry = {
	tag: string;
	when: number;
};

function getPostgresCode(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	const code = "code" in error ? error.code : undefined;
	return typeof code === "string" ? code : undefined;
}

async function tableExists(sql: Sql, tableName: string) {
	const rows = await sql`
		select 1
		from information_schema.tables
		where table_schema = 'public' and table_name = ${tableName}
		limit 1
	`;
	return rows.length > 0;
}

function readBaseline(migrationsFolder: string) {
	const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
	const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
		entries: JournalEntry[];
	};
	const [baseline] = journal.entries;

	if (!baseline) {
		throw new Error("No baseline migration found in drizzle journal.");
	}

	const migrationPath = path.join(migrationsFolder, `${baseline.tag}.sql`);
	const query = fs.readFileSync(migrationPath, "utf8");

	return {
		hash: crypto.createHash("sha256").update(query).digest("hex"),
		when: baseline.when,
	};
}

export async function repairLegacySchema(sql: Sql) {
	await sql.unsafe(`
		do $$
		begin
			if exists (select 1 from pg_type where typname = 'serverStatus')
				and not exists (select 1 from pg_type where typname = 'runtimeWorkerStatus') then
				alter type "serverStatus" rename to "runtimeWorkerStatus";
			end if;

			if exists (select 1 from pg_type where typname = 'serverType')
				and not exists (select 1 from pg_type where typname = 'runtimeWorkerType') then
				alter type "serverType" rename to "runtimeWorkerType";
			end if;

			if to_regclass('public."project"') is not null
				and to_regclass('public."workspace"') is null then
				alter table "project" rename to "workspace";
			end if;

			if to_regclass('public."project_tag"') is not null
				and to_regclass('public."workspace_tag"') is null then
				alter table "project_tag" rename to "workspace_tag";
			end if;

			if to_regclass('public."server"') is not null
				and to_regclass('public."runtimeWorker"') is null then
				alter table "server" rename to "runtimeWorker";
			end if;
		end $$;
	`);

	await sql.unsafe(`
		create or replace function pg_temp.rename_column_if_exists(
			p_table_name text,
			p_old_column text,
			p_new_column text
		) returns void as $$
		declare
			resolved_table regclass;
		begin
			resolved_table := to_regclass(format('%I.%I', 'public', p_table_name));

			if resolved_table is null then
				return;
			end if;

			if exists (
				select 1
				from information_schema.columns
				where table_schema = 'public'
					and columns.table_name = p_table_name
					and column_name = p_old_column
			) and not exists (
				select 1
				from information_schema.columns
				where table_schema = 'public'
					and columns.table_name = p_table_name
					and column_name = p_new_column
			) then
				execute format(
					'alter table %s rename column %I to %I',
					resolved_table,
					p_old_column,
					p_new_column
				);
			end if;
		end;
		$$ language plpgsql;

		select pg_temp.rename_column_if_exists('workspace', 'projectId', 'workspaceId');
		select pg_temp.rename_column_if_exists('workspace_tag', 'projectId', 'workspaceId');
		select pg_temp.rename_column_if_exists('environment', 'projectId', 'workspaceId');

		select pg_temp.rename_column_if_exists('runtimeWorker', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('runtimeWorker', 'serverStatus', 'runtimeWorkerStatus');
		select pg_temp.rename_column_if_exists('runtimeWorker', 'serverType', 'runtimeWorkerType');

		select pg_temp.rename_column_if_exists('application', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('application', 'buildServerId', 'buildRuntimeWorkerId');
		select pg_temp.rename_column_if_exists('certificate', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('compose', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('deployment', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('deployment', 'buildServerId', 'buildRuntimeWorkerId');
		select pg_temp.rename_column_if_exists('libsql', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('mariadb', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('mongo', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('mysql', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('postgres', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('redis', 'serverId', 'runtimeWorkerId');
		select pg_temp.rename_column_if_exists('schedule', 'serverId', 'runtimeWorkerId');

		select pg_temp.rename_column_if_exists('member', 'canCreateProjects', 'canCreateWorkspaces');
		select pg_temp.rename_column_if_exists('member', 'canDeleteProjects', 'canDeleteWorkspaces');
		select pg_temp.rename_column_if_exists('member', 'accesedProjects', 'accessedWorkspaces');
		select pg_temp.rename_column_if_exists('member', 'accessedServers', 'accessedRuntimeWorkers');
	`);

	await sql.unsafe(`
		do $$
		begin
			if exists (select 1 from pg_type where typname = 'scheduleType') then
				alter type "scheduleType" add value if not exists 'runtimeWorker';
			end if;
		end $$;
	`);

	await sql.unsafe(`
		update "schedule"
		set "scheduleType" = 'runtimeWorker'
		where "scheduleType"::text = 'server';
	`).catch((error) => {
		const code = getPostgresCode(error);
		if (code === "42P01" || code === "42703") {
			return;
		}
		throw error;
	});
}

export async function adoptResetBaseline(
	sql: Sql,
	migrationsFolder = "drizzle",
) {
	const hasExistingSchema =
		(await tableExists(sql, "account")) &&
		(await tableExists(sql, "application")) &&
		(await tableExists(sql, "member")) &&
		(await tableExists(sql, "runtimeWorker")) &&
		(await tableExists(sql, "workspace"));

	if (!hasExistingSchema) {
		return;
	}

	const baseline = readBaseline(migrationsFolder);

	await sql.unsafe(`create schema if not exists "drizzle";`);
	await sql.unsafe(`
		create table if not exists "drizzle"."__drizzle_migrations" (
			id serial primary key,
			hash text not null,
			created_at bigint
		);
	`);

	const latest = await sql`
		select created_at
		from "drizzle"."__drizzle_migrations"
		order by created_at desc
		limit 1
	`;

	if (latest[0] && Number(latest[0].created_at) >= baseline.when) {
		return;
	}

	const existingBaseline = await sql`
		select 1
		from "drizzle"."__drizzle_migrations"
		where hash = ${baseline.hash} or created_at = ${baseline.when}
		limit 1
	`;

	if (existingBaseline.length === 0) {
		await sql`
			insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
			values (${baseline.hash}, ${baseline.when})
		`;
		console.log("[migrate-db] Adopted reset baseline for existing schema");
	}
}
