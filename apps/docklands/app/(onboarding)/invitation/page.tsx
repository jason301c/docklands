import { redirect } from "next/navigation";
import { getUserByToken } from "@/server/core/services/admin";
import ClientPage from "./_client";

type PageProps = {
	searchParams: Promise<{ token?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
	const { token } = await searchParams;
	if (typeof token !== "string") {
		redirect("/");
	}

	try {
		const invitation = await getUserByToken(token);
		if (invitation.isExpired) {
			redirect("/");
		}

		return (
			<ClientPage
				token={token}
				invitation={invitation}
				userAlreadyExists={!!invitation.userAlreadyExists}
			/>
		);
	} catch {
		redirect("/");
	}
}
