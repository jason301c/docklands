import type { ReactNode } from "react";

export function SignInWithSSO({
	children,
}: {
	children?: ReactNode;
	enforce?: boolean;
}) {
	return <>{children ?? null}</>;
}
