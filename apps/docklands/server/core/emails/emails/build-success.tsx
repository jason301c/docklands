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
	projectName: string;
	applicationName: string;
	applicationType: string;
	buildLink: string;
	date: string;
	environmentName: string;
};

export const BuildSuccessEmail = ({
	projectName = "Docklands",
	applicationName = "frontend",
	applicationType = "application",
	buildLink = siteConfig.links.github,
	date = "2023-05-01T00:00:00.000Z",
	environmentName = "production",
}: TemplateProps) => {
	const previewText = `Build success for ${applicationName}`;
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
				<Body className="bg-white my-auto mx-auto font-sans px-2">
					<Container className="border border-solid border-[#e5e5e5] rounded-lg my-[40px] mx-auto p-[20px] max-w-[465px]">
						<Section className="mt-[32px]">
							<Img
								src={siteConfig.assets.logoDark}
								width="72"
								height="72"
								alt="Docklands"
								className="my-0 mx-auto"
							/>
						</Section>
						<Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
							Build success for <strong>{applicationName}</strong>
						</Heading>
						<Text className="text-black text-[14px] leading-[24px]">
							Hello,
						</Text>
						<Text className="text-black text-[14px] leading-[24px]">
							Your build for <strong>{applicationName}</strong> was successful
						</Text>
						<Section className="flex text-black text-[14px]  leading-[24px] bg-[#f5f5f5] rounded-lg p-2">
							<Text className="!leading-3 font-bold">Details: </Text>
							<Text className="!leading-3">
								Workspace Name: <strong>{projectName}</strong>
							</Text>
							<Text className="!leading-3">
								Application Name: <strong>{applicationName}</strong>
							</Text>
							<Text className="!leading-3">
								Environment: <strong>{environmentName}</strong>
							</Text>
							<Text className="!leading-3">
								Application Type: <strong>{applicationType}</strong>
							</Text>
							<Text className="!leading-3">
								Date: <strong>{date}</strong>
							</Text>
						</Section>
						<Section className="text-center mt-[32px] mb-[32px]">
							<Button
								href={buildLink}
								className="bg-brand rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
							>
								View build
							</Button>
						</Section>
						<Text className="text-black text-[14px] leading-[24px]">
							or copy and paste this URL into your browser:{" "}
							<Link href={buildLink} className="text-blue-600 no-underline">
								{buildLink}
							</Link>
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default BuildSuccessEmail;
