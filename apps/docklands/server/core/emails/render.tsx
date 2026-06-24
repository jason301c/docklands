import { render } from "@react-email/components";
import InvitationEmail from "./emails/invitation";

/** Render the invitation email template to an HTML string for sending. */
export const renderInvitationEmail = async ({
	email,
	inviteLink,
	organizationName,
}: {
	email: string;
	inviteLink: string;
	organizationName: string;
}) => {
	return render(
		InvitationEmail({
			inviteLink,
			toEmail: email,
			organizationName,
		}),
	);
};
