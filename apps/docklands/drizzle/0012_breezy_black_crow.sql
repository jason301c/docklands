CREATE INDEX "application_environmentId_idx" ON "application" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "application_runtimeWorkerId_idx" ON "application" USING btree ("runtimeWorkerId");--> statement-breakpoint
CREATE INDEX "compose_environmentId_idx" ON "compose" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "compose_runtimeWorkerId_idx" ON "compose" USING btree ("runtimeWorkerId");--> statement-breakpoint
CREATE INDEX "database_environmentId_idx" ON "database" USING btree ("environmentId");--> statement-breakpoint
CREATE INDEX "database_runtimeWorkerId_idx" ON "database" USING btree ("runtimeWorkerId");--> statement-breakpoint
CREATE INDEX "deployment_applicationId_createdAt_idx" ON "deployment" USING btree ("applicationId","createdAt");--> statement-breakpoint
CREATE INDEX "deployment_composeId_createdAt_idx" ON "deployment" USING btree ("composeId","createdAt");--> statement-breakpoint
CREATE INDEX "deployment_runtimeWorkerId_idx" ON "deployment" USING btree ("runtimeWorkerId");--> statement-breakpoint
CREATE INDEX "domain_applicationId_idx" ON "domain" USING btree ("applicationId");--> statement-breakpoint
CREATE INDEX "domain_composeId_idx" ON "domain" USING btree ("composeId");--> statement-breakpoint
CREATE INDEX "domain_previewDeploymentId_idx" ON "domain" USING btree ("previewDeploymentId");--> statement-breakpoint
CREATE INDEX "environment_workspaceId_idx" ON "environment" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "mount_applicationId_idx" ON "mount" USING btree ("applicationId");--> statement-breakpoint
CREATE INDEX "mount_composeId_idx" ON "mount" USING btree ("composeId");--> statement-breakpoint
CREATE INDEX "mount_databaseId_idx" ON "mount" USING btree ("databaseId");--> statement-breakpoint
CREATE INDEX "port_applicationId_idx" ON "port" USING btree ("applicationId");