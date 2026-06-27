import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Switch } from "@cloudflare/kumo/components/switch";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useUrl } from "@/client/hooks/use-url";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";
import { fetchGithubSetupState } from "./setup-state";

export const AddGithubProvider = () => {
	const [isOpen, setIsOpen] = useState(false);
	// Prefer the configured app URL over the browsing origin so the manifest's
	// callback/webhook URLs are reachable even when set up from localhost.
	const url = useUrl();
	const [manifest, setManifest] = useState("");
	const [isOrganization, setIsOrganization] = useState(false);
	const [organizationName, setOrganization] = useState("");
	const [isPreparing, setIsPreparing] = useState(false);

	const randomString = () => Math.random().toString(36).slice(2, 8);

	useEffect(() => {
		if (!url) return;
		const manifest = JSON.stringify(
			{
				redirect_url: `${url}/api/providers/github/setup`,
				name: `Docklands-${format(new Date(), "yyyy-MM-dd")}-${randomString()}`,
				url,
				hook_attributes: {
					url: `${url}/api/deploy/github`,
				},
				callback_urls: [`${url}/api/providers/github/setup`],
				public: false,
				request_oauth_on_install: true,
				default_permissions: {
					contents: "read",
					metadata: "read",
					emails: "read",
					pull_requests: "write",
				},
				default_events: ["pull_request", "push"],
			},
			null,
			4,
		);

		setManifest(manifest);
	}, [url]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!url || !manifest) return;
		setIsPreparing(true);
		try {
			const state = await fetchGithubSetupState(
				new URLSearchParams({ action: "gh_init" }),
			);
			const target = isOrganization
				? `https://github.com/organizations/${organizationName}/settings/apps/new?state=${encodeURIComponent(state)}`
				: `https://github.com/settings/apps/new?state=${encodeURIComponent(state)}`;
			const form = document.createElement("form");
			form.method = "post";
			form.action = target;
			const input = document.createElement("input");
			input.type = "hidden";
			input.name = "manifest";
			input.value = manifest;
			form.append(input);
			document.body.append(form);
			form.submit();
		} catch (error) {
			toast.error("Could not prepare GitHub setup", {
				description:
					error instanceof Error ? error.message : "Please try again.",
			});
			setIsPreparing(false);
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger
				render={
					<Button
						variant="outline"
						className="flex items-center gap-2 bg-kumo-base hover:bg-kumo-tint"
					>
						<GithubIcon className="text-current fill-current" />
						<span>Github</span>
					</Button>
				}
			/>
			<Dialog className="sm:max-w-2xl ">
				<Dialog.Header>
					<Dialog.Title className="flex items-center gap-2">
						Github Provider <GithubIcon className="size-5" />
					</Dialog.Title>
				</Dialog.Header>

				<div id="hook-form-add-workspace" className="grid w-full gap-1">
					<div className="p-0">
						<div className="flex flex-col ">
							<p className="text-kumo-subtle text-sm">
								To integrate your GitHub account with our services, you'll need
								to create and install a GitHub app. This process is
								straightforward and only takes a few minutes. Click the button
								below to get started.
							</p>
							<div className="mt-4 flex flex-col gap-4">
								<div className="flex flex-row gap-4">
									<span>Organization?</span>
									<Switch
										checked={isOrganization}
										onCheckedChange={(checked) => setIsOrganization(checked)}
									/>
								</div>

								{isOrganization && (
									<Input
										aria-label="GitHub organization name"
										required
										placeholder="Organization name"
										onChange={(e) => setOrganization(e.target.value)}
									/>
								)}
							</div>
							<form onSubmit={handleSubmit} method="post">
								<input
									type="text"
									name="manifest"
									id="manifest"
									defaultValue={manifest}
									className="invisible"
								/>
								<br />

								<div className="flex w-full items-center justify-between">
									<a
										href={
											isOrganization && organizationName
												? `https://github.com/organizations/${organizationName}/settings/installations`
												: "https://github.com/settings/installations"
										}
										className={`text-kumo-brand text-sm hover:underline duration-300
											 ${
													isOrganization && !organizationName
														? "pointer-events-none opacity-50"
														: ""
}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										Unsure if you already have an app?
									</a>
									<Button
										variant="primary"
										disabled={
											isPreparing ||
											(isOrganization && organizationName.length < 1)
										}
										type="submit"
										className="self-end"
									>
										{isPreparing && <Loader2 className="size-4 animate-spin" />}
										Create GitHub App
									</Button>
								</div>
							</form>
						</div>
					</div>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
