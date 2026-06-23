import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

interface InvitationEmailProps {
	inviteLink: string;
	toEmail: string;
	organizationName: string;
}

export const InvitationEmail = ({
	inviteLink,
	toEmail,
	organizationName = "an organization",
}: InvitationEmailProps) => {
	const previewText = `You've been invited to join ${organizationName} on Docklands`;
	return (
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Tailwind
				config={{
					theme: {
						extend: {
							colors: {
								brand: "#056DFF",
							},
						},
					},
				}}
			>
				<Body className="bg-[#f5f5f5] my-auto mx-auto font-sans">
					<Container className="my-[40px] mx-auto max-w-[520px]">
						{/* Header */}
						<Section className="bg-[#171717] rounded-t-xl px-[40px] py-[32px] text-center">
							<Img
								src="https://raw.githubusercontent.com/jason301c/docklands/refs/heads/canary/apps/docklands/public/docklands-logo-light.svg"
								width="96"
								height="96"
								alt="Docklands"
								className="my-0 mx-auto"
							/>
						</Section>

						{/* Body */}
						<Section className="bg-white px-[40px] py-[32px]">
							<Heading className="text-[#171717] text-[22px] font-semibold m-0 mb-[8px]">
								You've been invited to join {organizationName}
							</Heading>
							<Text className="text-[#737373] text-[14px] leading-[22px] m-0 mb-[24px]">
								You have been invited to join{" "}
								<strong className="text-[#171717]">{organizationName}</strong>{" "}
								on Docklands, the platform for deploying your apps to the cloud.
								Click the button below to accept the invitation.
							</Text>

							{/* CTA Button */}
							<Section className="text-center mb-[24px]">
								<Button
									href={inviteLink}
									className="bg-brand rounded-lg text-white text-[14px] font-semibold no-underline text-center px-[24px] py-[12px]"
								>
									Accept Invitation
								</Button>
							</Section>

							<Text className="text-[#a3a3a3] text-[13px] leading-[20px] m-0 text-center mb-[16px]">
								If the button above doesn't work, copy and paste the following
								link into your browser:
							</Text>
							<Text className="text-[#737373] text-[12px] leading-[18px] m-0 text-center break-all">
								{inviteLink}
							</Text>
						</Section>

						{/* Footer */}
						<Section className="bg-[#fafafa] rounded-b-xl px-[40px] py-[24px] text-center border-t border-solid border-[#e5e5e5]">
							<Hr className="border border-solid border-[#e5e5e5] my-0 mb-[16px] mx-0 w-full" />
							<Text className="text-[#a3a3a3] text-[12px] leading-[18px] m-0">
								This invitation was intended for{" "}
								<span className="text-[#737373]">{toEmail}</span>. This invite
								was sent from{" "}
								<Link
									href="https://github.com/jason301c/docklands"
									className="text-[#737373] underline"
								>
									Docklands
								</Link>
								. If you were not expecting this invitation, you can safely
								ignore this email.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default InvitationEmail;
