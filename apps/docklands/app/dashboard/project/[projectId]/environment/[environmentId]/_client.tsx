"use client";

import { EnvironmentCanvas } from "@/components/dashboard/workspace/environment-canvas";

const EnvironmentPage = (props: {
	projectId: string;
	environmentId: string;
}) => {
	return <EnvironmentCanvas {...props} />;
};

export default EnvironmentPage;
