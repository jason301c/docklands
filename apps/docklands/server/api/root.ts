import { createTRPCRouter } from "../api/trpc";
import { applicationRouter } from "./routers/application";
import { auditLogRouter } from "./routers/audit-log";
import { backupRouter } from "./routers/backup";
import { bitbucketRouter } from "./routers/bitbucket";
import { certificateRouter } from "./routers/certificate";
import { clusterRouter } from "./routers/cluster";
import { composeRouter } from "./routers/compose";
import { customRoleRouter } from "./routers/custom-role";
import { databaseRouter } from "./routers/database";
import { deploymentRouter } from "./routers/deployment";
import { destinationRouter } from "./routers/destination";
import { dockerRouter } from "./routers/docker";
import { domainRouter } from "./routers/domain";
import { environmentRouter } from "./routers/environment";
import { gitProviderRouter } from "./routers/git-provider";
import { giteaRouter } from "./routers/gitea";
import { githubRouter } from "./routers/github";
import { gitlabRouter } from "./routers/gitlab";
import { mountRouter } from "./routers/mount";
import { notificationRouter } from "./routers/notification";
import { organizationRouter } from "./routers/organization";
import { patchRouter } from "./routers/patch";
import { portRouter } from "./routers/port";
import { previewDeploymentRouter } from "./routers/preview-deployment";
import { redirectsRouter } from "./routers/redirects";
import { registryRouter } from "./routers/registry";
import { rollbackRouter } from "./routers/rollbacks";
import { runtimeWorkerRouter } from "./routers/runtime-worker";
import { securityRouter } from "./routers/security";
import { serviceDatabaseRouter } from "./routers/service-database";
import { settingsRouter } from "./routers/settings";
import { sshRouter } from "./routers/ssh-key";
import { swarmRouter } from "./routers/swarm";
import { tagRouter } from "./routers/tag";
import { userRouter } from "./routers/user";
import { volumeBackupsRouter } from "./routers/volume-backups";
import { workspaceRouter } from "./routers/workspace";
import { workspaceGraphRouter } from "./routers/workspace-graph";

/**
 * This is the primary router for your runtimeWorker.
 *
 * All routers added in /api/routers should be manually added here.
 */

export const appRouter = createTRPCRouter({
	application: applicationRouter,
	backup: backupRouter,
	bitbucket: bitbucketRouter,
	certificates: certificateRouter,
	cluster: clusterRouter,
	compose: composeRouter,
	database: databaseRouter,
	deployment: deploymentRouter,
	destination: destinationRouter,
	docker: dockerRouter,
	domain: domainRouter,
	gitea: giteaRouter,
	gitProvider: gitProviderRouter,
	github: githubRouter,
	gitlab: gitlabRouter,
	mounts: mountRouter,
	notification: notificationRouter,
	port: portRouter,
	previewDeployment: previewDeploymentRouter,
	redirects: redirectsRouter,
	registry: registryRouter,
	security: securityRouter,
	settings: settingsRouter,
	sshKey: sshRouter,
	swarm: swarmRouter,
	user: userRouter,
	organization: organizationRouter,
	customRole: customRoleRouter,
	serviceDatabase: serviceDatabaseRouter,
	auditLog: auditLogRouter,
	rollback: rollbackRouter,
	volumeBackups: volumeBackupsRouter,
	environment: environmentRouter,
	tag: tagRouter,
	patch: patchRouter,
	workspaceGraph: workspaceGraphRouter,
	workspaces: workspaceRouter,
	runtimeWorker: runtimeWorkerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
