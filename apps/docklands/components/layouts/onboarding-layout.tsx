import type React from "react";

interface Props {
	children: React.ReactNode;
}
export const OnboardingLayout = ({ children }: Props) => {
	return (
		<div className="min-h-svh w-full bg-background px-4 py-10">
			<div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-md items-center justify-center">
				{children}
			</div>
		</div>
	);
};
