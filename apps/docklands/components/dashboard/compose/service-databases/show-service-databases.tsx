import { Badge } from "@cloudflare/kumo/components/badge";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { SensitiveInput } from "@cloudflare/kumo/components/sensitive-input";
import { ChevronDown, ChevronRight, Database, DatabaseZap } from "lucide-react";
import { useState } from "react";
import { api } from "@/client/api/trpc";
import {
	LibsqlIcon,
	MariadbIcon,
	MongodbIcon,
	MysqlIcon,
	PostgresqlIcon,
	RedisIcon,
} from "@/components/icons/data-tools-icons";
import { SectionCard } from "@/components/shared/section-card";
import { ShowServiceDatabaseBackups } from "./show-service-database-backups";

type ServiceDatabaseEngine =
	| "postgres"
	| "mysql"
	| "mariadb"
	| "mongo"
	| "redis"
	| "libsql";

const EngineIcon = ({
	engine,
	className,
}: {
	engine: ServiceDatabaseEngine;
	className?: string;
}) => {
	switch (engine) {
		case "postgres":
			return <PostgresqlIcon className={className} />;
		case "mysql":
			return <MysqlIcon className={className} />;
		case "mariadb":
			return <MariadbIcon className={className} />;
		case "mongo":
			return <MongodbIcon className={className} />;
		case "redis":
			return <RedisIcon className={className} />;
		case "libsql":
			return <LibsqlIcon className={className} />;
		default:
			return <DatabaseZap className={className} />;
	}
};

/**
 * Heuristic: secret-looking connection variables (passwords, urls, tokens) are
 * masked behind a toggle/copy input; plain host/port/user values are shown.
 */
const isSensitiveKey = (key: string) =>
	/PASS|SECRET|TOKEN|URL|URI|DSN/i.test(key);

const ConnectionVariables = ({
	serviceDatabaseId,
}: {
	serviceDatabaseId: string;
}) => {
	const { data, isLoading } = api.serviceDatabase.connectionInfo.useQuery(
		{ serviceDatabaseId },
		{ enabled: !!serviceDatabaseId },
	);

	if (isLoading) {
		return (
			<p className="text-sm text-kumo-subtle">Loading connection variables…</p>
		);
	}

	if (!data || data.connectionVariables.length === 0) {
		return (
			<p className="text-sm text-kumo-subtle">
				No connection variables available.
			</p>
		);
	}

	return (
		<div className="grid w-full md:grid-cols-2 gap-4">
			{data.connectionVariables.map((variable) => (
				<div className="flex flex-col gap-2" key={variable.key}>
					<Label>{variable.key}</Label>
					{isSensitiveKey(variable.key) ? (
						<SensitiveInput
							aria-label={variable.key}
							readOnly
							value={variable.value}
						/>
					) : (
						<Input aria-label={variable.key} disabled value={variable.value} />
					)}
				</div>
			))}
		</div>
	);
};

const ServiceDatabaseCard = ({
	database,
	runtimeWorkerId,
}: {
	database: {
		serviceDatabaseId: string;
		serviceName: string;
		engine: ServiceDatabaseEngine;
		image: string;
		supportsBackup: boolean;
	};
	runtimeWorkerId?: string;
}) => {
	const [varsOpen, setVarsOpen] = useState(false);

	return (
		<LayerCard className="bg-kumo-canvas">
			<div className="flex flex-col gap-4">
				<div className="flex flex-row items-center gap-3">
					<div className="flex items-center justify-center size-10 rounded-lg">
						<EngineIcon engine={database.engine} className="size-7" />
					</div>
					<div className="flex flex-col gap-0.5">
						<div className="flex items-center gap-2">
							<h3 className="font-medium">{database.serviceName}</h3>
							<Badge variant="secondary" className="capitalize">
								{database.engine}
							</Badge>
						</div>
						<span className="text-xs text-kumo-subtle">{database.image}</span>
					</div>
				</div>

				<Collapsible.Root open={varsOpen} onOpenChange={setVarsOpen}>
					<Collapsible.Trigger
						render={
							<button
								type="button"
								className="flex w-full items-center gap-2 text-left text-sm font-medium text-kumo-default"
							/>
						}
					>
						{varsOpen ? (
							<ChevronDown className="size-4 text-kumo-subtle" />
						) : (
							<ChevronRight className="size-4 text-kumo-subtle" />
						)}
						Connection variables
					</Collapsible.Trigger>
					<Collapsible.Panel className="pt-4">
						<ConnectionVariables
							serviceDatabaseId={database.serviceDatabaseId}
						/>
					</Collapsible.Panel>
				</Collapsible.Root>

				{database.supportsBackup && (
					<div className="flex flex-col gap-3 border-t pt-4">
						<div className="flex items-center gap-2">
							<Database className="size-4 text-kumo-subtle" />
							<h4 className="text-sm font-semibold">Backups</h4>
						</div>
						<ShowServiceDatabaseBackups
							serviceDatabaseId={database.serviceDatabaseId}
							engine={
								database.engine as "postgres" | "mariadb" | "mysql" | "mongo"
							}
							serviceName={database.serviceName}
							runtimeWorkerId={runtimeWorkerId}
						/>
					</div>
				)}
			</div>
		</LayerCard>
	);
};

interface Props {
	composeId: string;
}

export const ShowServiceDatabases = ({ composeId }: Props) => {
	const { data: databases } = api.serviceDatabase.byCompose.useQuery(
		{ composeId },
		{ enabled: !!composeId },
	);
	const { data: compose } = api.compose.one.useQuery(
		{ composeId },
		{ enabled: !!composeId },
	);

	if (!databases || databases.length === 0) {
		return (
			<LayerCard className="bg-kumo-canvas">
				<div className="flex flex-col items-center gap-3 py-10 justify-center">
					<DatabaseZap className="size-8 text-kumo-subtle" />
					<span className="text-base text-kumo-subtle text-center">
						No databases detected in this stack.
					</span>
				</div>
			</LayerCard>
		);
	}

	return (
		<SectionCard
			icon={DatabaseZap}
			title="Detected Databases"
			description="Databases discovered inside this compose stack. Their connection variables and backups are managed by Docklands."
			contentClassName="space-y-4"
		>
			{databases.map((database) => (
				<ServiceDatabaseCard
					key={database.serviceDatabaseId}
					database={database}
					runtimeWorkerId={compose?.runtimeWorkerId || undefined}
				/>
			))}
		</SectionCard>
	);
};
