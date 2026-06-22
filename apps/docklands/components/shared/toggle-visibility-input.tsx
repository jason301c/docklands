import { Button } from "@cloudflare/kumo/components/button";
import { Input, type InputProps } from "@cloudflare/kumo/components/input";
import copy from "copy-to-clipboard";
import { Clipboard } from "lucide-react";
import { useRef } from "react";
import { toast } from "@/components/shared/toast";

export const ToggleVisibilityInput = ({ ...props }: InputProps) => {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="flex w-full items-center space-x-2">
			<Input ref={inputRef} {...props} type="password" />
			<Button
				aria-label="Copy hidden input value"
				variant={"secondary"}
				onClick={() => {
					copy(inputRef.current?.value || "");
					toast.success("Value is copied to clipboard");
				}}
			>
				<Clipboard className="size-4 text-muted-foreground" />
			</Button>
			{/* <Button onClick={togglePasswordVisibility} variant={"secondary"}>
				{isPasswordVisible ? (
					<EyeOffIcon className="size-4 text-muted-foreground" />
				) : (
					<EyeIcon className="size-4 text-muted-foreground" />
				)}
			</Button> */}
		</div>
	);
};
