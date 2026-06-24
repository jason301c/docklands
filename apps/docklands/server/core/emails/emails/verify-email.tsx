import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import { siteConfig } from "@/shared/site";

export type TemplateProps = {
	userName: string;
	verificationUrl: string;
};

export const VerifyEmailTemplate = ({
	userName = "User",
	verificationUrl = "http://localhost:3000/verify",
}: TemplateProps) => {
	const previewText = "Verify your email address to get started with Docklands";
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
								src={siteConfig.assets.logoLight}
								width="96"
								height="96"
								alt="Docklands"
								className="my-0 mx-auto"
							/>
						</Section>

						{/* Body */}
						<Section className="bg-white px-[40px] py-[32px]">
							<Heading className="text-[#171717] text-[22px] font-semibold m-0 mb-[8px]">
								Verify Your Email
							</Heading>
							<Text className="text-[#737373] text-[14px] leading-[22px] m-0 mb-[24px]">
								Hello {userName}, thank you for signing up for Docklands. Please
								verify your email address to activate your account.
							</Text>

							{/* CTA Button */}
							<Section className="text-center mb-[24px]">
								<Button
									href={verificationUrl}
									className="bg-brand rounded-lg text-white text-[14px] font-semibold no-underline text-center px-[24px] py-[12px]"
								>
									Verify Email Address
								</Button>
							</Section>

							<Text className="text-[#a3a3a3] text-[13px] leading-[20px] m-0 text-center mb-[16px]">
								If the button above doesn't work, copy and paste the following
								link into your browser:
							</Text>
							<Text className="text-[#737373] text-[12px] leading-[18px] m-0 text-center break-all">
								{verificationUrl}
							</Text>
						</Section>

						{/* Footer */}
						<Section className="bg-[#fafafa] rounded-b-xl px-[40px] py-[24px] text-center border-t border-solid border-[#e5e5e5]">
							<Text className="text-[#a3a3a3] text-[12px] leading-[18px] m-0">
								This is an automated email from{" "}
								<Link
									href={siteConfig.links.github}
									className="text-[#737373] underline"
								>
									Docklands
								</Link>
								. If you didn't create an account, you can safely ignore this
								email.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default VerifyEmailTemplate;
