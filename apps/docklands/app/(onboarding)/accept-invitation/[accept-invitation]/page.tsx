import ClientPage from "./_client";

type PageProps = {
	params: Promise<{ "accept-invitation": string }>;
};

export default async function Page({ params }: PageProps) {
	const resolvedParams = await params;
	return <ClientPage invitationId={resolvedParams["accept-invitation"]} />;
}
