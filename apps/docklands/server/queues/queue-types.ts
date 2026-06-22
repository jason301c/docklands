type DeployJob =
	| {
			applicationId: string;
			titleLog: string;
			descriptionLog: string;
			runtimeWorker?: boolean;
			type: "deploy" | "redeploy";
			applicationType: "application";
			runtimeWorkerId?: string;
	  }
	| {
			composeId: string;
			titleLog: string;
			descriptionLog: string;
			runtimeWorker?: boolean;
			type: "deploy" | "redeploy";
			applicationType: "compose";
			runtimeWorkerId?: string;
	  }
	| {
			applicationId: string;
			titleLog: string;
			descriptionLog: string;
			runtimeWorker?: boolean;
			type: "deploy" | "redeploy";
			applicationType: "application-preview";
			previewDeploymentId: string;
			runtimeWorkerId?: string;
	  };

export type DeploymentJob = DeployJob;
