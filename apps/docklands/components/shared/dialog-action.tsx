import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@/components/shared/dialog";

interface Props {
	title?: string | React.ReactNode;
	description?: string | React.ReactNode;
	onClick: () => void;
	children?: React.ReactNode;
	disabled?: boolean;
	type?: "default" | "secondary" | "destructive";
}

export const DialogAction = ({
	onClick,
	children,
	description,
	title,
	disabled,
	type,
}: Props) => {
	const confirmVariant =
		type === "default" ? "secondary" : (type ?? "destructive");

	return (
		<Dialog.Root role="alertdialog">
			<Dialog.Trigger render={children as never} />
			<Dialog>
				<Dialog.Header>
					<Dialog.Title>{title ?? "Are you absolutely sure?"}</Dialog.Title>
					<Dialog.Description>
						{description ?? "This action cannot be undone."}
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
					<Dialog.Close
						render={
							<Button
								disabled={disabled}
								onClick={onClick}
								variant={confirmVariant}
							>
								Confirm
							</Button>
						}
					/>
				</Dialog.Footer>
			</Dialog>
		</Dialog.Root>
	);
};
