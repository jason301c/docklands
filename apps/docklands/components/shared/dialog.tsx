import {
	type DialogDescriptionProps,
	type DialogProps,
	type DialogTitleProps,
	Dialog as KumoDialog,
} from "@cloudflare/kumo/components/dialog";
import type { ComponentProps } from "react";
import { cn } from "@/shared/utils";

/**
 * Styled wrapper over Kumo's headless Dialog.
 *
 * Kumo ships the Dialog content panel and the `Title`/`Description` primitives
 * with no padding or typography — its own docs expect every call site to add
 * `className="p-8"`, `text-2xl font-semibold`, `text-kumo-subtle`, and header/
 * footer margins by hand. Repeating that across ~100 dialogs left them cramped
 * and inconsistent, so this module bakes the canonical Kumo look in once:
 *
 * ```tsx
 * <Dialog.Root>
 *   <Dialog.Trigger render={<Button>Open</Button>} />
 *   <Dialog>
 *     <Dialog.Header>
 *       <Dialog.Title>Title</Dialog.Title>
 *       <Dialog.Description>Subtitle</Dialog.Description>
 *     </Dialog.Header>
 *     ...body...
 *     <Dialog.Footer>
 *       <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
 *       <Button>Save</Button>
 *     </Dialog.Footer>
 *   </Dialog>
 * </Dialog.Root>
 * ```
 *
 * Every default merges via tailwind-merge, so a call site can still override —
 * e.g. `<Dialog className="p-0">` for full-bleed content (logs, terminals), or
 * `<Dialog.Footer className="justify-start">` to left-align actions.
 */

function DialogContent({ className, ...props }: DialogProps) {
	return <KumoDialog className={cn("p-6", className)} {...props} />;
}

function DialogTitle({ className, ...props }: DialogTitleProps) {
	return (
		<KumoDialog.Title
			className={cn("text-lg font-semibold text-kumo-default", className)}
			{...props}
		/>
	);
}

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
	return (
		<KumoDialog.Description
			className={cn("text-sm text-kumo-subtle", className)}
			{...props}
		/>
	);
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />
	);
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn("mt-6 flex items-center justify-end gap-2", className)}
			{...props}
		/>
	);
}

/**
 * Compound Dialog. `Root`, `Trigger`, and `Close` pass straight through to Kumo;
 * the content panel, `Title`, `Description`, `Header`, and `Footer` carry the
 * shared styling above.
 */
export const Dialog = Object.assign(DialogContent, {
	Root: KumoDialog.Root,
	Trigger: KumoDialog.Trigger,
	Close: KumoDialog.Close,
	Title: DialogTitle,
	Description: DialogDescription,
	Header: DialogHeader,
	Footer: DialogFooter,
});
