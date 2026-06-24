"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/client/api/trpc";
import { createClientLogger } from "@/client/lib/logger";
import { Dialog } from "@/components/shared/dialog";
import { toast } from "@/components/shared/toast";
import { cn } from "@/shared/utils";
import type { WorkspaceGroup } from "@/shared/workspace-graph";

const logger = createClientLogger("workspace-group-dialog");

// A small, theme-friendly palette of accent tints. `null` falls back to the
// default brand tint rendered by the group node.
export const GROUP_COLOR_OPTIONS: { label: string; value: string | null }[] = [
	{ label: "Brand", value: null },
	{ label: "Blue", value: "#3b82f6" },
	{ label: "Green", value: "#22c55e" },
	{ label: "Amber", value: "#f59e0b" },
	{ label: "Red", value: "#ef4444" },
	{ label: "Purple", value: "#a855f7" },
	{ label: "Teal", value: "#14b8a6" },
	{ label: "Pink", value: "#ec4899" },
];

export type GroupDialogState =
	| { mode: "create" }
	| { mode: "edit"; group: WorkspaceGroup };

/**
 * Create / rename / recolor dialog for a named canvas group. Owns its own form
 * state and invalidates the environment graph on success so the canvas reflects
 * the change. New groups are placed near the canvas origin; the user drags/
 * resizes them afterwards.
 */
export const GroupDialog = ({
	state,
	environmentId,
	onOpenChange,
}: {
	state: GroupDialogState | null;
	environmentId: string;
	onOpenChange: (open: boolean) => void;
}) => {
	const utils = api.useUtils();
	const createGroup = api.workspaceGraph.createGroup.useMutation();
	const updateGroup = api.workspaceGraph.updateGroup.useMutation();

	const [name, setName] = useState("");
	const [color, setColor] = useState<string | null>(null);

	const isEdit = state?.mode === "edit";

	// Seed the form whenever the dialog target changes.
	useEffect(() => {
		if (!state) return;
		if (state.mode === "edit") {
			setName(state.group.name);
			setColor(state.group.color);
		} else {
			setName("");
			setColor(null);
		}
	}, [state]);

	const isPending = createGroup.isPending || updateGroup.isPending;

	const submit = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Group name is required");
			return;
		}

		try {
			if (state?.mode === "edit") {
				await updateGroup.mutateAsync({
					groupId: state.group.groupId,
					name: trimmed,
					color,
				});
			} else {
				await createGroup.mutateAsync({
					environmentId,
					name: trimmed,
					color: color ?? undefined,
					// Place new groups near the top-left; the user repositions after.
					x: 40,
					y: 40,
				});
			}
			await utils.workspaceGraph.byEnvironment.invalidate({ environmentId });
			toast.success(isEdit ? "Group updated" : "Group created");
			onOpenChange(false);
		} catch (error) {
			logger.error("Could not save group", error);
			toast.error(
				`Could not save group: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	return (
		<Dialog.Root open={!!state} onOpenChange={onOpenChange}>
			<Dialog className="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>{isEdit ? "Edit group" : "New group"}</Dialog.Title>
					<Dialog.Description>
						Group services into a named, colored region on the canvas. Services
						keep their position; grouping is a visual label.
					</Dialog.Description>
				</Dialog.Header>

				<div className="space-y-4">
					<div className="space-y-2">
						<p className="text-sm font-medium">Name</p>
						<Input
							autoFocus
							value={name}
							placeholder="e.g. Apps, Data, Infra"
							maxLength={60}
							onChange={(event) => setName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									void submit();
								}
							}}
						/>
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">Color</p>
						<div className="flex flex-wrap gap-2">
							{GROUP_COLOR_OPTIONS.map((option) => {
								const selected = option.value === color;
								return (
									<button
										key={option.label}
										type="button"
										aria-label={option.label}
										aria-pressed={selected}
										onClick={() => setColor(option.value)}
										className={cn(
											"relative flex size-8 items-center justify-center rounded-md border-2 transition",
											selected
												? "border-kumo-default"
												: "border-transparent hover:border-kumo-line",
										)}
										style={{
											backgroundColor: option.value
												? `color-mix(in srgb, ${option.value} 20%, transparent)`
												: "var(--color-kumo-fill)",
										}}
									>
										<span
											className="size-4 rounded-full"
											style={{
												backgroundColor:
													option.value ?? "var(--color-kumo-brand)",
											}}
										/>
										{selected && (
											<Check className="pointer-events-none absolute size-3.5 text-kumo-default" />
										)}
									</button>
								);
							})}
						</div>
					</div>
				</div>

				<Dialog.Footer>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => void submit()}
						loading={isPending}
						disabled={!name.trim()}
					>
						{isEdit ? "Save group" : "Create group"}
					</Button>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
