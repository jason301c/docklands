"use client";

import { authClient } from "@/client/auth/client";
import { Button } from "@/components/ui/button";

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
