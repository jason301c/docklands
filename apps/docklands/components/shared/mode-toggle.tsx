"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { Moon, Sun } from "lucide-react";
import type { ComponentProps } from "react";
import { useTheme } from "@/client/providers/theme-provider";

export function ModeToggle({
	variant = "outline",
	className,
}: {
	variant?: ComponentProps<typeof Button>["variant"];
	className?: string;
}) {
	const { theme, setTheme } = useTheme();

	const toggleTheme = () => {
		if (theme === "dark") {
			setTheme("light");
		} else {
			setTheme("dark");
		}
	};

	return (
		<Button
			variant={variant}
			shape="square"
			aria-label="Toggle theme"
			onClick={toggleTheme}
			className={className}
		>
			<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
