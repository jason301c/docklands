"use client";

import { Select as KumoSelect } from "@cloudflare/kumo/components/select";
import { Children, isValidElement, type ReactNode } from "react";

type SelectProps<T, M extends boolean | undefined = false> = Parameters<
	typeof KumoSelect<T, M>
>[0];

type DerivedItem = { label: ReactNode; value: unknown };

/**
 * App `Select` wrapper around Cloudflare Kumo's `Select`.
 *
 * Kumo resolves the **trigger** label from its `items` prop, not from the
 * `Select.Option` children — children only populate the popup list. Every call
 * site in this app passes children only, so the trigger renders the raw selected
 * *value* (e.g. `0`) instead of its *label* (e.g. `Never`). This wrapper walks the
 * children, derives an `items` map from each `Select.Option`'s value + content,
 * and passes both: the popup still renders the (possibly grouped/rich) children,
 * while the trigger shows the matching label. Pass `items` (or `renderValue`)
 * explicitly to override the derivation.
 *
 * Import this instead of `@cloudflare/kumo/components/select` everywhere; it is a
 * drop-in (same generics, same `Option`/`Group`/`GroupLabel`/`Separator` parts).
 */
function collectOptions(node: ReactNode, acc: DerivedItem[]): void {
	Children.forEach(node, (child) => {
		if (!isValidElement(child)) return;
		if (child.type === KumoSelect.Option) {
			const props = child.props as { value: unknown; children?: ReactNode };
			acc.push({ value: props.value, label: props.children });
			return;
		}
		// Recurse through fragments, groups, and other wrappers to find options.
		const props = child.props as { children?: ReactNode };
		if (props?.children != null) collectOptions(props.children, acc);
	});
}

export function Select<T, M extends boolean | undefined = false>(
	props: SelectProps<T, M>,
) {
	const { children, items, renderValue } = props;
	let resolvedItems = items;
	// `renderValue` already owns the trigger; only derive when neither it nor an
	// explicit `items` map is supplied.
	if (resolvedItems == null && renderValue == null && children != null) {
		const derived: DerivedItem[] = [];
		collectOptions(children, derived);
		if (derived.length > 0) {
			resolvedItems = derived as SelectProps<T, M>["items"];
		}
	}
	return <KumoSelect {...props} items={resolvedItems} />;
}

Select.Option = KumoSelect.Option;
Select.Group = KumoSelect.Group;
Select.GroupLabel = KumoSelect.GroupLabel;
Select.Separator = KumoSelect.Separator;
