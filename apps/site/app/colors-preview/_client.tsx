"use client";

import { Badge } from "@cloudflare/kumo/components/badge";
import { Banner } from "@cloudflare/kumo/components/banner";
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Field } from "@cloudflare/kumo/components/field";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Loader, SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Select } from "@cloudflare/kumo/components/select";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Table } from "@cloudflare/kumo/components/table";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
	ArrowRightIcon,
	DatabaseIcon,
	PlusIcon,
	RocketIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-14">
			<h2 className="font-display font-semibold text-2xl text-kumo-strong tracking-tight">
				{title}
			</h2>
			<div className="mt-5">{children}</div>
		</section>
	);
}

function Swatch({ name, token }: { name: string; token: string }) {
	return (
		<div className="flex flex-col gap-1.5">
			<div
				className="h-16 w-full rounded-lg border border-kumo-hairline"
				style={{ background: `var(--color-kumo-${token})` }}
			/>
			<p className="px-0.5 font-medium text-kumo-strong text-xs">{name}</p>
		</div>
	);
}

function SwatchGroup({
	title,
	swatches,
}: {
	title: string;
	swatches: { name: string; token: string }[];
}) {
	return (
		<Section title={title}>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
				{swatches.map((s) => (
					<Swatch key={s.token} name={s.name} token={s.token} />
				))}
			</div>
		</Section>
	);
}

/** A bordered surface to group a row of mock components. */
function Panel({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-4 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
			{children}
		</div>
	);
}

const TEXT_TOKENS = [
	{ name: "Default", token: "default" },
	{ name: "Strong", token: "strong" },
	{ name: "Subtle", token: "subtle" },
	{ name: "Inactive", token: "inactive" },
	{ name: "Placeholder", token: "placeholder" },
	{ name: "Link", token: "link" },
	{ name: "Info", token: "info" },
	{ name: "Success", token: "success" },
	{ name: "Danger", token: "danger" },
	{ name: "Warning", token: "warning" },
	{ name: "Brand", token: "brand" },
];

const TABS = [
	{ value: "overview", label: "Overview" },
	{ value: "deployments", label: "Deployments" },
	{ value: "logs", label: "Logs" },
	{ value: "settings", label: "Settings" },
];

export function ColorsPreview() {
	const [tab, setTab] = useState("overview");

	return (
		<main className="mx-auto w-full max-w-6xl px-6 py-16">
			<h1 className="font-display font-semibold text-5xl text-kumo-strong tracking-tight">
				Colors &amp; components
			</h1>

			{/* ---- Color tokens ---- */}
			<SwatchGroup
				title="Brand & focus"
				swatches={[
					{ name: "Brand", token: "brand" },
					{ name: "Brand hover", token: "brand-hover" },
					{ name: "Focus", token: "focus" },
					{ name: "Line", token: "line" },
				]}
			/>
			<SwatchGroup
				title="Surfaces"
				swatches={[
					{ name: "Canvas", token: "canvas" },
					{ name: "Base", token: "base" },
					{ name: "Elevated", token: "elevated" },
					{ name: "Recessed", token: "recessed" },
					{ name: "Overlay", token: "overlay" },
					{ name: "Control", token: "control" },
					{ name: "Tint", token: "tint" },
					{ name: "Contrast", token: "contrast" },
				]}
			/>
			<SwatchGroup
				title="Fills & lines"
				swatches={[
					{ name: "Fill", token: "fill" },
					{ name: "Fill hover", token: "fill-hover" },
					{ name: "Interact", token: "interact" },
					{ name: "Hairline", token: "hairline" },
				]}
			/>
			<SwatchGroup
				title="Status"
				swatches={[
					{ name: "Success", token: "success" },
					{ name: "Success tint", token: "success-tint" },
					{ name: "Info", token: "info" },
					{ name: "Info tint", token: "info-tint" },
					{ name: "Warning", token: "warning" },
					{ name: "Warning tint", token: "warning-tint" },
					{ name: "Danger", token: "danger" },
					{ name: "Danger tint", token: "danger-tint" },
				]}
			/>
			<SwatchGroup
				title="Badges"
				swatches={[
					{ name: "Red", token: "badge-red" },
					{ name: "Orange", token: "badge-orange" },
					{ name: "Purple", token: "badge-purple" },
					{ name: "Teal", token: "badge-teal" },
					{ name: "Blue", token: "badge-blue" },
					{ name: "Neutral", token: "badge-neutral" },
					{ name: "Inverted", token: "badge-inverted" },
				]}
			/>

			{/* ---- Text colors ---- */}
			<Section title="Text colors">
				<div className="grid gap-3 rounded-xl border border-kumo-hairline bg-kumo-base p-6 sm:grid-cols-2">
					{TEXT_TOKENS.map((t) => (
						<span
							key={t.token}
							className="text-lg"
							style={{ color: `var(--text-color-kumo-${t.token})` }}
						>
							{t.name} — the quick brown fox
						</span>
					))}
					<div className="rounded-md bg-kumo-contrast px-3 py-1">
						<span
							className="text-lg"
							style={{ color: "var(--text-color-kumo-inverse)" }}
						>
							Inverse — on a dark surface
						</span>
					</div>
				</div>
			</Section>

			{/* ---- Typography ---- */}
			<Section title="Typography">
				<div className="space-y-6 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<div>
						<p className="text-kumo-subtle text-xs">Display — Fraunces</p>
						<p className="mt-1 font-display font-semibold text-4xl text-kumo-strong tracking-tight">
							Deploy anything on infrastructure you own.
						</p>
					</div>
					<div>
						<p className="text-kumo-subtle text-xs">Body — Inter</p>
						<p className="mt-1 text-base text-kumo-default leading-relaxed">
							Docklands is a self-hosted deployment control plane. The quick
							brown fox jumps over the lazy dog. 0123456789
						</p>
					</div>
				</div>
			</Section>

			{/* ---- Buttons ---- */}
			<Section title="Buttons">
				<Panel>
					<Button variant="primary">Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="destructive">Destructive</Button>
					<Button variant="primary" icon={<ArrowRightIcon weight="bold" />}>
						With icon
					</Button>
					<Button variant="primary" loading>
						Loading
					</Button>
					<Button variant="primary" disabled>
						Disabled
					</Button>
				</Panel>
			</Section>

			{/* ---- Badges ---- */}
			<Section title="Badges">
				<Panel>
					<Badge variant="primary">Primary</Badge>
					<Badge variant="secondary">Secondary</Badge>
					<Badge variant="success">Running</Badge>
					<Badge variant="warning">Deploying</Badge>
					<Badge variant="error">Failed</Badge>
					<Badge variant="info">Queued</Badge>
					<Badge variant="beta">Beta</Badge>
					<Badge variant="outline">Outline</Badge>
				</Panel>
			</Section>

			{/* ---- Form controls ---- */}
			<Section title="Form controls">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-4 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
						<Field label="Service name" description="Lowercase, no spaces.">
							<Input placeholder="my-api" aria-label="Service name" />
						</Field>
						<Field label="Notes">
							<Textarea
								placeholder="Anything worth remembering…"
								rows={3}
								aria-label="Notes"
							/>
						</Field>
						<Select label="Region" defaultValue="iad" aria-label="Region">
							<Select.Option value="iad">Ashburn (iad)</Select.Option>
							<Select.Option value="sjc">San Jose (sjc)</Select.Option>
							<Select.Option value="ams">Amsterdam (ams)</Select.Option>
						</Select>
					</div>
					<div className="flex flex-col gap-4 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
						<Switch label="Auto-deploy on push" defaultChecked />
						<Switch label="Expose publicly" />
						<Checkbox label="Run database migrations" />
						<Checkbox label="Enable health checks" />
						<Radio defaultValue="github" aria-label="Source">
							<Radio.Item label="GitHub" value="github" />
							<Radio.Item label="Docker image" value="image" />
							<Radio.Item label="Compose file" value="compose" />
						</Radio>
					</div>
				</div>
			</Section>

			{/* ---- Feedback ---- */}
			<Section title="Feedback">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-3">
						<Banner variant="default">
							A new runtime worker is available.
						</Banner>
						<Banner variant="secondary">
							Deployment finished successfully.
						</Banner>
						<Banner variant="alert">
							This service has no health check configured.
						</Banner>
						<Banner variant="error">
							Build failed — exit code 1. Check the logs.
						</Banner>
					</div>
					<div className="flex flex-col gap-4 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
						<Meter label="Disk usage" value={72} showValue />
						<Meter label="API requests" value={45} customValue="450 / 1,000" />
						<div className="flex items-center gap-4">
							<Loader />
							<Tooltip content="This is a tooltip">
								<Button variant="secondary">Hover for tooltip</Button>
							</Tooltip>
						</div>
						<SkeletonLine />
						<SkeletonLine />
					</div>
				</div>
			</Section>

			{/* ---- Navigation ---- */}
			<Section title="Navigation">
				<div className="flex flex-col gap-5 rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<Breadcrumbs>
						<Breadcrumbs.Link href="#">Workspace</Breadcrumbs.Link>
						<Breadcrumbs.Separator />
						<Breadcrumbs.Link href="#">production</Breadcrumbs.Link>
						<Breadcrumbs.Separator />
						<Breadcrumbs.Current>web</Breadcrumbs.Current>
					</Breadcrumbs>

					<div>
						<Tabs tabs={TABS} value={tab} onValueChange={setTab} />
						<div className="mt-3 text-kumo-subtle text-sm">
							Showing the <span className="text-kumo-strong">{tab}</span> tab.
						</div>
					</div>

					<Link href="#">A standalone text link →</Link>
				</div>
			</Section>

			{/* ---- Data & containers ---- */}
			<Section title="Data & containers">
				<div className="grid gap-4 lg:grid-cols-2">
					{/* Table */}
					<div className="overflow-hidden rounded-xl border border-kumo-hairline bg-kumo-base">
						<Table>
							<Table.Header>
								<Table.Row>
									<Table.Head>Service</Table.Head>
									<Table.Head>Status</Table.Head>
									<Table.Head>Updated</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								<Table.Row>
									<Table.Cell>web</Table.Cell>
									<Table.Cell>
										<Badge variant="success">Running</Badge>
									</Table.Cell>
									<Table.Cell>2m ago</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>worker</Table.Cell>
									<Table.Cell>
										<Badge variant="warning">Deploying</Badge>
									</Table.Cell>
									<Table.Cell>just now</Table.Cell>
								</Table.Row>
								<Table.Row>
									<Table.Cell>postgres</Table.Cell>
									<Table.Cell>
										<Badge variant="error">Crashed</Badge>
									</Table.Cell>
									<Table.Cell>5m ago</Table.Cell>
								</Table.Row>
							</Table.Body>
						</Table>
					</div>

					{/* Layer cards + collapsible + code */}
					<div className="flex flex-col gap-4">
						<LayerCard.Primary className="p-5">
							<p className="font-medium text-kumo-strong">Primary layer card</p>
							<p className="mt-1 text-kumo-subtle text-sm">
								Elevated container for grouped content.
							</p>
						</LayerCard.Primary>
						<LayerCard.Secondary className="p-5">
							<p className="font-medium text-kumo-strong">Secondary layer card</p>
							<p className="mt-1 text-kumo-subtle text-sm">
								A quieter, recessed grouping.
							</p>
						</LayerCard.Secondary>

						<Collapsible.Root defaultOpen>
							<Collapsible.Trigger>Environment variables</Collapsible.Trigger>
							<Collapsible.Panel>
								<div className="pt-2">
									<code className="rounded-md bg-kumo-recessed px-2 py-1 font-mono text-kumo-default text-sm">
										DATABASE_URL=postgres://…
									</code>
								</div>
							</Collapsible.Panel>
						</Collapsible.Root>
					</div>
				</div>
			</Section>

			{/* ---- Empty state ---- */}
			<Section title="Empty state">
				<div className="rounded-xl border border-kumo-hairline bg-kumo-base p-6">
					<Empty
						icon={<RocketIcon />}
						title="No deployments yet"
						description="Connect a repository or push an image to deploy your first service."
					/>
				</div>
			</Section>

			{/* ---- Icons sample (so warmth shows on glyphs too) ---- */}
			<Section title="Icons">
				<Panel>
					<RocketIcon className="size-6 text-kumo-strong" />
					<DatabaseIcon className="size-6 text-kumo-strong" />
					<PlusIcon className="size-6 text-kumo-brand" />
					<ArrowRightIcon className="size-6 text-kumo-subtle" />
				</Panel>
			</Section>
		</main>
	);
}
