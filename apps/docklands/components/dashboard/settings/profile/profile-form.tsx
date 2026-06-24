import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cloudflare/kumo/components/popover";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, Palette } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/client/api/trpc";
import { crudMutationOptions } from "@/client/lib/crud-mutation";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/shared/avatar";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/shared/form";
import { PageSection } from "@/components/shared/page-section";
import { SectionCard } from "@/components/shared/section-card";
import { isSolidColorAvatar } from "@/shared/avatar-utils";
import {
	cn,
	generateSHA256Hash,
	getFallbackAvatarInitials,
} from "@/shared/utils";
import { Passkeys } from "./passkeys";

const PRESET_AVATARS = [
	"/avatars/avatar-1.png",
	"/avatars/avatar-2.png",
	"/avatars/avatar-3.png",
	"/avatars/avatar-4.png",
	"/avatars/avatar-5.png",
	"/avatars/avatar-6.png",
	"/avatars/avatar-7.png",
	"/avatars/avatar-8.png",
	"/avatars/avatar-9.png",
	"/avatars/avatar-10.png",
	"/avatars/avatar-11.png",
	"/avatars/avatar-12.png",
];

/** Display name from first/last with an email fallback. */
function displayName(user?: {
	firstName?: string | null;
	lastName?: string | null;
	email?: string | null;
}) {
	const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
	return name || user?.email || "";
}

/**
 * The account identity banner: a large avatar, the user's name + email, and a
 * "Change photo" popover that picks (and immediately persists) an avatar from a
 * default initials option, a custom solid color, or the preset gallery.
 */
function AccountIdentity() {
	const { data } = api.user.get.useQuery();
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const [gravatarHash, setGravatarHash] = useState<string | null>(null);
	const colorInputRef = useRef<HTMLInputElement>(null);

	const user = data?.user;
	const current = user?.image ?? "";

	useEffect(() => {
		if (user?.email) {
			generateSHA256Hash(user.email).then(setGravatarHash);
		}
	}, [user?.email]);

	const choices = useMemo(() => {
		if (gravatarHash === null) return PRESET_AVATARS;
		return PRESET_AVATARS.concat([
			`https://www.gravatar.com/avatar/${gravatarHash}`,
		]);
	}, [gravatarHash]);

	const update = api.user.update.useMutation(
		crudMutationOptions({
			successMessage: "Avatar updated",
			errorMessage: "Failed to update avatar",
			loggerScope: "profile",
			invalidate: () => utils.user.get.invalidate(),
			onSuccess: () => setOpen(false),
		}),
	);

	const choose = (image: string) => {
		if (image === current) {
			setOpen(false);
			return;
		}
		update.mutate({ image });
	};

	const initials = getFallbackAvatarInitials(displayName(user));

	return (
		<PageSection className="flex-row items-center gap-4 p-5 sm:gap-5">
			<Avatar className="size-16 border sm:size-20">
				<AvatarImage src={current || undefined} alt="" />
				<AvatarFallback className="text-lg">{initials}</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-base font-semibold">
					{displayName(user) || "Your account"}
				</span>
				<span className="truncate text-sm text-kumo-subtle">{user?.email}</span>
			</div>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button variant="secondary" loading={update.isPending}>
							Change photo
						</Button>
					}
				/>
				<PopoverContent className="w-auto p-3" align="end">
					<div className="grid grid-cols-6 gap-2">
						<button
							type="button"
							aria-label="Use initials"
							title="Initials"
							onClick={() => choose("")}
							className={cn(
								"flex size-9 items-center justify-center rounded-full border bg-kumo-fill text-xs font-medium text-kumo-subtle transition-colors hover:border-kumo-brand",
								current === "" && "ring-2 ring-kumo-focus ring-offset-1",
							)}
						>
							{initials}
						</button>
						<button
							type="button"
							aria-label="Pick a color"
							title="Solid color"
							onClick={() => colorInputRef.current?.click()}
							className={cn(
								"flex size-9 items-center justify-center rounded-full border transition-colors hover:border-kumo-brand",
								isSolidColorAvatar(current) &&
									"ring-2 ring-kumo-focus ring-offset-1",
							)}
							style={{
								backgroundColor: isSolidColorAvatar(current)
									? current
									: undefined,
							}}
						>
							{!isSolidColorAvatar(current) && (
								<Palette className="size-4 text-kumo-subtle" />
							)}
						</button>
						<input
							ref={colorInputRef}
							type="color"
							aria-hidden
							tabIndex={-1}
							className="pointer-events-none absolute size-0 opacity-0"
							value={current.startsWith("#") ? current : "#6366f1"}
							onChange={(e) => choose(e.target.value)}
						/>
						{choices.map((image) => (
							<button
								key={image}
								type="button"
								aria-label="Select avatar"
								onClick={() => choose(image)}
								className={cn(
									"size-9 overflow-hidden rounded-full border transition-colors hover:border-kumo-brand",
									current === image && "ring-2 ring-kumo-focus ring-offset-1",
								)}
							>
								<img src={image} alt="" className="size-full object-cover" />
							</button>
						))}
					</div>
				</PopoverContent>
			</Popover>
		</PageSection>
	);
}

const profileSchema = z.object({
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	email: z
		.string()
		.email("Please enter a valid email address")
		.min(1, "Email is required"),
});

type ProfileValues = z.infer<typeof profileSchema>;

/** The "Profile" card: editable name + email. */
function ProfileSection() {
	const { data, isPending } = api.user.get.useQuery();
	const utils = api.useUtils();

	const form = useForm<ProfileValues>({
		defaultValues: { firstName: "", lastName: "", email: "" },
		resolver: zodResolver(profileSchema),
	});

	useEffect(() => {
		if (data?.user) {
			form.reset({
				firstName: data.user.firstName ?? "",
				lastName: data.user.lastName ?? "",
				email: data.user.email ?? "",
			});
		}
	}, [data, form]);

	const update = api.user.update.useMutation(
		crudMutationOptions({
			successMessage: "Profile updated",
			errorMessage: "Failed to update profile",
			loggerScope: "profile",
			invalidate: () => utils.user.get.invalidate(),
		}),
	);

	const onSubmit = (values: ProfileValues) =>
		update.mutate({
			email: values.email.toLowerCase(),
			firstName: values.firstName || undefined,
			lastName: values.lastName || undefined,
		});

	return (
		<SectionCard title="Profile" contentClassName="space-y-4">
			{isPending ? (
				<LoadingRow />
			) : (
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>First name</FormLabel>
										<FormControl>
											<Input placeholder="John" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="lastName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Last name</FormLabel>
										<FormControl>
											<Input placeholder="Doe" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input placeholder="you@example.com" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="flex justify-end">
							<Button
								type="submit"
								loading={update.isPending}
								disabled={!form.formState.isDirty}
							>
								Save changes
							</Button>
						</div>
					</form>
				</Form>
			)}
		</SectionCard>
	);
}

const passwordSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password"),
		password: z.string().min(8, "Use at least 8 characters"),
	})
	.refine((values) => values.currentPassword !== values.password, {
		message: "New password must differ from the current one",
		path: ["password"],
	});

type PasswordValues = z.infer<typeof passwordSchema>;

/** The "Security" card: password change + passkeys. */
function SecuritySection() {
	const utils = api.useUtils();

	const form = useForm<PasswordValues>({
		defaultValues: { currentPassword: "", password: "" },
		resolver: zodResolver(passwordSchema),
	});

	const update = api.user.update.useMutation(
		crudMutationOptions({
			successMessage: "Password updated",
			errorMessage: "Failed to update password",
			loggerScope: "profile",
			invalidate: () => utils.user.get.invalidate(),
			onSuccess: () => form.reset({ currentPassword: "", password: "" }),
		}),
	);

	const onSubmit = (values: PasswordValues) =>
		update.mutate({
			currentPassword: values.currentPassword,
			password: values.password,
		});

	return (
		<SectionCard title="Security" contentClassName="space-y-6">
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<FormField
							control={form.control}
							name="currentPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Current password</FormLabel>
									<FormControl>
										<Input
											type="password"
											autoComplete="current-password"
											placeholder="••••••••"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>New password</FormLabel>
									<FormControl>
										<Input
											type="password"
											autoComplete="new-password"
											placeholder="••••••••"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<div className="flex justify-end">
						<Button
							type="submit"
							variant="secondary"
							loading={update.isPending}
							disabled={!form.formState.isDirty}
						>
							Update password
						</Button>
					</div>
				</form>
			</Form>

			<Passkeys />
		</SectionCard>
	);
}

function LoadingRow() {
	return (
		<div className="flex min-h-[20vh] items-center justify-center gap-2 text-sm text-kumo-subtle">
			<span>Loading...</span>
			<Loader2 className="size-4 animate-spin" />
		</div>
	);
}

export const ProfileForm = () => {
	return (
		<div className="flex flex-col gap-4">
			<AccountIdentity />
			<ProfileSection />
			<SecuritySection />
		</div>
	);
};
