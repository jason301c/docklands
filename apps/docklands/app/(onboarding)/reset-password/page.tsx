import { redirect } from "next/navigation";
import ClientPage from "./_client";

type PageProps = {
	searchParams: Promise<{ token?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
	const { token } = await searchParams;
	if (typeof token !== "string") {
		redirect("/");
	}

	return <ClientPage tokenResetPassword={token} />;
}
