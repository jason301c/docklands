import path from "node:path";
import { nanoid } from "nanoid";
import { quote } from "shell-quote";
import { getStaticCommand } from "@/server/core/utils/builders/static";
import { prepareEnvironmentVariablesForShell } from "../docker/utils";
import { getBuildAppDirectory } from "../filesystem/directory";
import type { ApplicationNested } from ".";

export const getNixpacksCommand = (application: ApplicationNested) => {
	const { env, appName, publishDirectory, cleanCache } = application;

	const buildAppDirectory = getBuildAppDirectory(application);
	const buildContainerId = `${appName}-${nanoid(10)}`;
	const envVariables = prepareEnvironmentVariablesForShell(
		env,
		application.environment.workspace.env,
		application.environment.env,
	);

	const args = ["build", buildAppDirectory, "--name", appName];

	if (cleanCache) {
		args.push("--no-cache");
	}

	for (const env of envVariables) {
		args.push("--env", env);
	}

	if (publishDirectory) {
		/* No need for any start command, since we'll use nginx later on */
		args.push("--no-error-without-start");
	}
	const command = `nixpacks ${args.join(" ")}`;
	let bashCommand = `
		echo "Starting nixpacks build..." ;
		${command} || {
			echo "❌ Nixpacks build failed" ;
			exit 1;
		}
		echo "✅ Nixpacks build completed." ;
		`;

	/*
		Run the container with the image created by nixpacks,
		and copy the artifacts on the host filesystem.
		Then, remove the container and create a static build.
	 */
	if (publishDirectory) {
		const localPath = path.join(buildAppDirectory, publishDirectory);
		const isDirectory =
			publishDirectory.endsWith("/") || !path.extname(publishDirectory);

		const copySource = `${buildContainerId}:/app/${publishDirectory}${isDirectory ? "/." : ""}`;
		bashCommand += `
	# Always remove the temporary extraction container on exit (success, copy
	# failure, or the build being killed) so failed builds don't leak containers.
	trap 'docker rm -f ${buildContainerId} >/dev/null 2>&1 || true' EXIT
	docker create --name ${buildContainerId} ${quote([appName])}
	mkdir -p ${quote([localPath])}
	docker cp ${quote([copySource])} ${quote([localPath])} || {
		echo ${quote([`❌ Copying ${publishDirectory} to ${localPath} failed`])} ;
		exit 1;
	}
	${getStaticCommand(application)}
				`;
	}

	return bashCommand;
};
