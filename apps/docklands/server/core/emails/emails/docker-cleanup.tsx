import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

export type TemplateProps = {
	message: string;
	date: string;
};

export const DockerCleanupEmail = ({
	message = "Container runtime cleanup for Docklands",
	date = "2023-05-01T00:00:00.000Z",
}: TemplateProps) => {
	const previewText = "Container runtime cleanup for Docklands";
	return (
		<Html>
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
				<Head />

				<Body className="bg-white my-auto mx-auto font-sans px-2">
					<Container className="border border-solid border-[#e5e5e5] rounded-lg my-[40px] mx-auto p-[20px] max-w-[465px]">
						<Section className="mt-[32px]">
							<Img
								src={
									"https://raw.githubusercontent.com/jason301c/docklands/refs/heads/canary/apps/docklands/public/docklands-logo-dark.svg"
								}
								width="72"
								height="72"
								alt="Docklands"
								className="my-0 mx-auto"
							/>
						</Section>
						<Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
							Container runtime cleanup for <strong>Docklands</strong>
						</Heading>
						<Text className="text-black text-[14px] leading-[24px]">
							Hello,
						</Text>
						<Text className="text-black text-[14px] leading-[24px]">
							The container runtime cleanup for <strong>Docklands</strong> was
							successful ✅
						</Text>

						<Section className="flex text-black text-[14px]  leading-[24px] bg-[#f5f5f5] rounded-lg p-2">
							<Text className="!leading-3 font-bold">Details: </Text>
							<Text className="!leading-3">
								Message: <strong>{message}</strong>
							</Text>
							<Text className="!leading-3">
								Date: <strong>{date}</strong>
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default DockerCleanupEmail;
