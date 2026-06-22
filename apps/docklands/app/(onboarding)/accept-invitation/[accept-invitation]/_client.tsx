"use client";

import { Button } from "@cloudflare/kumo/components/button";
import { authClient } from "@/client/auth/client";

export const AcceptInvitation = ({
	invitationId,
}: {
	invitationId: string;
}) => {
	// const { data: organization } = api.organization.getById.useQuery({
	//     id: id as string
	// })

	return (
		<div>
			<Button
				onClick={async () => {
					const result = await authClient.organization.acceptInvitation({
						invitationId: invitationId,
					});
					console.log(result);
				}}
			>
				Accept Invitation
			</Button>
		</div>
	);
};

export default AcceptInvitation;
