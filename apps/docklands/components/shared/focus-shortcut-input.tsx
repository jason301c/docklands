import { Input } from "@cloudflare/kumo/components/input";
import { useEffect, useRef } from "react";

type Props = React.ComponentPropsWithoutRef<typeof Input>;

export const FocusShortcutInput = (props: Props) => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const accessibleName =
		props.label || props["aria-label"] || props["aria-labelledby"]
			? {}
			: {
					"aria-label":
						typeof props.placeholder === "string"
							? props.placeholder
							: "Shortcut input",
				};

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const isMod = e.metaKey || e.ctrlKey;
			if (!isMod || e.code !== "KeyK") return;

			const target = e.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (
					target.isContentEditable ||
					tag === "INPUT" ||
					tag === "TEXTAREA" ||
					tag === "SELECT" ||
					target.getAttribute("role") === "textbox"
				)
					return;
			}

			e.preventDefault();
			inputRef.current?.focus();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return <Input {...props} {...accessibleName} ref={inputRef} />;
};
