"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
	theme: Theme;
	setTheme: (theme: Theme | ((theme: Theme) => Theme)) => void;
	resolvedTheme: ResolvedTheme;
	systemTheme: ResolvedTheme;
	themes: Theme[];
	forcedTheme?: Theme;
};

type ThemeProviderProps = {
	children: ReactNode;
	attribute?: "data-mode";
	defaultTheme?: Theme;
	enableSystem?: boolean;
	enableColorScheme?: boolean;
	storageKey?: string;
};

const THEME_ATTRIBUTE = "mode";
const DEFAULT_THEMES: Theme[] = ["light", "dark", "system"];
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined") {
		return "light";
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
	if (typeof window === "undefined") {
		return defaultTheme;
	}

	const storedTheme = window.localStorage.getItem(storageKey);
	if (
		storedTheme === "light" ||
		storedTheme === "dark" ||
		storedTheme === "system"
	) {
		return storedTheme;
	}

	return defaultTheme;
}

export function ThemeProvider({
	children,
	attribute = "data-mode",
	defaultTheme = "system",
	enableSystem = true,
	enableColorScheme = true,
	storageKey = "theme",
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(defaultTheme);
	const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

	useEffect(() => {
		setThemeState(getStoredTheme(storageKey, defaultTheme));
		setSystemTheme(getSystemTheme());
	}, [defaultTheme, storageKey]);

	const resolvedTheme =
		theme === "system" && enableSystem ? systemTheme : theme;
	const normalizedResolvedTheme =
		resolvedTheme === "system" ? systemTheme : resolvedTheme;

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => setSystemTheme(getSystemTheme());

		media.addEventListener("change", handleChange);
		handleChange();

		return () => {
			media.removeEventListener("change", handleChange);
		};
	}, []);

	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== storageKey) {
				return;
			}

			setThemeState(getStoredTheme(storageKey, defaultTheme));
		};

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [defaultTheme, storageKey]);

	useEffect(() => {
		if (attribute === "data-mode") {
			document.documentElement.dataset[THEME_ATTRIBUTE] =
				normalizedResolvedTheme;
		}

		if (enableColorScheme) {
			document.documentElement.style.colorScheme = normalizedResolvedTheme;
		}
	}, [attribute, enableColorScheme, normalizedResolvedTheme]);

	const setTheme = useCallback(
		(nextTheme: Theme | ((theme: Theme) => Theme)) => {
			setThemeState((currentTheme) => {
				const value =
					typeof nextTheme === "function" ? nextTheme(currentTheme) : nextTheme;
				window.localStorage.setItem(storageKey, value);
				return value;
			});
		},
		[storageKey],
	);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			setTheme,
			resolvedTheme: normalizedResolvedTheme,
			systemTheme,
			themes: DEFAULT_THEMES,
		}),
		[normalizedResolvedTheme, setTheme, systemTheme, theme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const value = useContext(ThemeContext);

	if (!value) {
		return {
			theme: "system" as Theme,
			setTheme: () => {},
			resolvedTheme: "light" as ResolvedTheme,
			systemTheme: "light" as ResolvedTheme,
			themes: DEFAULT_THEMES,
		};
	}

	return value;
}
