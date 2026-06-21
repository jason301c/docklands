"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { useState } from "react";
import { EnvironmentCanvas } from "@/components/dashboard/workspace/environment-canvas";
import LegacyEnvironmentPage from "./_legacy-list-client";

const EnvironmentPage = (props: {
	projectId: string;
	environmentId: string;
}) => {
	const [view, setView] = useState<"canvas" | "list">("canvas");

	if (view === "list") {
		return (
			<div>
				<div className="mb-3 flex justify-end">
					<Button variant="outline" onClick={() => setView("canvas")}>
						Canvas
					</Button>
				</div>
				<LegacyEnvironmentPage {...props} />
			</div>
		);
	}

	return (
		<EnvironmentCanvas {...props} onOpenListView={() => setView("list")} />
	);
};

export default EnvironmentPage;
