import { DropdownMenu as KumoDropdownMenu } from "@cloudflare/kumo/components/dropdown";
import type { ComponentProps } from "react";
import { cn } from "@/shared/utils";

/**
 * Styled wrapper over Kumo's headless DropdownMenu.
 *
 * Kumo's `DropdownMenu.Item` already highlights on hover/keyboard via
 * `data-highlighted:bg-kumo-overlay`, but it does so as an instant background
 * swap with no transition, so menus feel flat. This module bakes a single
 * canonical interaction in once — a smooth transition plus a subtle slide on
 * highlight, and a slightly stronger tint for the default variant — across the
 * actionable item parts (`Item`, `LinkItem`, `CheckboxItem`, `RadioItem`,
 * `SubTrigger`). The `"danger"` variant keeps Kumo's red highlight; we only add
 * the motion to it.
 *
 * Everything else (the root, `Trigger`, `Content`, `Group`, `Label`,
 * `Separator`, `Shortcut`, submenu plumbing, …) passes straight through. Every
 * default merges via tailwind-merge, so a call site can still override — e.g.
 * `<DropdownMenu.Item className="data-highlighted:translate-x-0">` to opt out of
 * the slide.
 *
 * Usage is identical to Kumo's; just import from here instead:
 *
 * ```tsx
 * import { DropdownMenu } from "@/components/shared/dropdown";
 *
 * <DropdownMenu>
 *   <DropdownMenu.Trigger render={<Button>Open</Button>} />
 *   <DropdownMenu.Content>
 *     <DropdownMenu.Item onClick={...}>Edit</DropdownMenu.Item>
 *     <DropdownMenu.Item variant="danger" onClick={...}>Delete</DropdownMenu.Item>
 *   </DropdownMenu.Content>
 * </DropdownMenu>
 * ```
 */

// Shared motion applied to every actionable item: smooth easing + a small slide
// on highlight. Kept color-agnostic so it composes with each variant's own
// highlight background.
const itemMotion =
	"cursor-pointer transition-[transform,background-color,color] duration-150 ease-out data-highlighted:translate-x-0.5";

type ItemProps = ComponentProps<typeof KumoDropdownMenu.Item>;

function DropdownItem({ className, variant, ...props }: ItemProps) {
	return (
		<KumoDropdownMenu.Item
			variant={variant}
			className={cn(
				itemMotion,
				// Default items get a slightly stronger tint than Kumo's faint
				// overlay; the danger variant keeps its own red highlight.
				variant !== "danger" && "data-highlighted:bg-kumo-tint",
				className,
			)}
			{...props}
		/>
	);
}

type LinkItemProps = ComponentProps<typeof KumoDropdownMenu.LinkItem>;

function DropdownLinkItem({ className, variant, ...props }: LinkItemProps) {
	return (
		<KumoDropdownMenu.LinkItem
			variant={variant}
			className={cn(
				itemMotion,
				variant !== "danger" && "data-highlighted:bg-kumo-tint",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownCheckboxItem({
	className,
	...props
}: ComponentProps<typeof KumoDropdownMenu.CheckboxItem>) {
	return (
		<KumoDropdownMenu.CheckboxItem
			className={cn(itemMotion, "data-highlighted:bg-kumo-tint", className)}
			{...props}
		/>
	);
}

function DropdownRadioItem({
	className,
	...props
}: ComponentProps<typeof KumoDropdownMenu.RadioItem>) {
	return (
		<KumoDropdownMenu.RadioItem
			className={cn(itemMotion, "data-highlighted:bg-kumo-tint", className)}
			{...props}
		/>
	);
}

function DropdownSubTrigger({
	className,
	...props
}: ComponentProps<typeof KumoDropdownMenu.SubTrigger>) {
	return (
		<KumoDropdownMenu.SubTrigger
			className={cn(itemMotion, "data-highlighted:bg-kumo-tint", className)}
			{...props}
		/>
	);
}

/**
 * Compound DropdownMenu. The root and every non-item part pass straight through
 * to Kumo; the actionable items carry the shared interaction above.
 *
 * `Object.assign` copies Kumo's attached parts onto a fresh root function (so we
 * never mutate the shared Kumo export), then our styled items override the
 * originals.
 */
export const DropdownMenu = Object.assign(
	(props: ComponentProps<typeof KumoDropdownMenu>) => (
		<KumoDropdownMenu {...props} />
	),
	KumoDropdownMenu,
	{
		Item: DropdownItem,
		LinkItem: DropdownLinkItem,
		CheckboxItem: DropdownCheckboxItem,
		RadioItem: DropdownRadioItem,
		SubTrigger: DropdownSubTrigger,
	},
);
