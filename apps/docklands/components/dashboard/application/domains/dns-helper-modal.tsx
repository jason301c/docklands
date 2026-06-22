import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Copy, HelpCircle, Server } from "lucide-react";
import { AlertBlock } from "@/components/shared/alert-block";
import { toast } from "@/components/shared/toast";

interface Props {
	domain: {
		host: string;
		https: boolean;
		path?: string;
	};
	serverIp?: string;
}

export const DnsHelperModal = ({ domain, serverIp }: Props) => {
	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard!");
	};

	return (
		<Dialog.Root>
			<Dialog.Trigger>
				<Button
					aria-label="Open DNS configuration guide"
					variant="ghost"
					shape="square"
					className="group"
				>
					<HelpCircle className="size-4" />
				</Button>
			</Dialog.Trigger>
			<Dialog className="sm:max-w-2xl">
				<div>
					<Dialog.Title className="flex items-center gap-2">
						<Server className="size-5" />
						DNS Configuration Guide
					</Dialog.Title>
					<Dialog.Description>
						Follow these steps to configure your DNS records for {domain.host}
					</Dialog.Description>
				</div>

				<div className="flex flex-col gap-4">
					<AlertBlock type="info">
						To make your domain accessible, you need to configure your DNS
						records with your domain provider (e.g., Cloudflare, GoDaddy,
						NameCheap).
					</AlertBlock>

					<div className="flex flex-col gap-6">
						<div className="rounded-lg border p-4">
							<h3 className="font-medium mb-2">1. Add A Record</h3>
							<div className="flex flex-col gap-3">
								<p className="text-sm text-muted-foreground">
									Create an A record that points your domain to the server's IP
									address:
								</p>
								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between gap-2 bg-muted p-3 rounded-md">
										<div>
											<p className="text-sm font-medium">Type: A</p>
											<p className="text-sm">
												Name: @ or {domain.host.split(".")[0]}
											</p>
											<p className="text-sm">
												Value: {serverIp || "Your server IP"}
											</p>
										</div>
										<Button
											aria-label="Copy server IP"
											variant="ghost"
											shape="square"
											onClick={() => copyToClipboard(serverIp || "")}
											disabled={!serverIp}
										>
											<Copy className="size-4" />
										</Button>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-lg border p-4">
							<h3 className="font-medium mb-2">2. Verify Configuration</h3>
							<div className="flex flex-col gap-3">
								<p className="text-sm text-muted-foreground">
									After configuring your DNS records:
								</p>
								<ul className="list-disc list-inside space-y-1 text-sm">
									<li>Wait for DNS propagation (usually 15-30 minutes)</li>
									<li>
										Test your domain by visiting:{" "}
										{domain.https ? "https://" : "http://"}
										{domain.host}
										{domain.path || "/"}
									</li>
									<li>Use a DNS lookup tool to verify your records</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</Dialog>
		</Dialog.Root>
	);
};
