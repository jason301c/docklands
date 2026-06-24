import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/core/db";
import {
	account,
	apikey,
	invitation,
	member,
	user,
} from "@/server/core/db/schema";
import { auth } from "../lib/auth";

export type User = typeof user.$inferSelect;

export const createOrganizationUserWithCredentials = async ({
	organizationId,
	email,
	password,
	role,
}: {
	organizationId: string;
	email: string;
	password: string;
	role: string;
}) => {
	const normalizedEmail = email.trim().toLowerCase();
	const now = new Date();

	return await db.transaction(async (tx) => {
		const existingUser = await tx.query.user.findFirst({
			where: eq(user.email, normalizedEmail),
			columns: {
				id: true,
			},
		});

		if (existingUser) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"This email already has an account. Use the invitation link flow for existing users.",
			});
		}

		const createdUser = await tx
			.insert(user)
			.values({
				email: normalizedEmail,
				emailVerified: false,
				updatedAt: now,
			})
			.returning({
				id: user.id,
				email: user.email,
			})
			.then((res) => res[0]);

		if (!createdUser) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create user",
			});
		}

		await tx.insert(account).values({
			userId: createdUser.id,
			providerId: "credential",
			password: bcrypt.hashSync(password, 10),
			createdAt: now,
			updatedAt: now,
		});

		await tx.insert(member).values({
			organizationId,
			userId: createdUser.id,
			role,
			createdAt: now,
		});

		await tx
			.update(invitation)
			.set({
				status: "canceled",
			})
			.where(
				and(
					eq(invitation.organizationId, organizationId),
					eq(invitation.email, normalizedEmail),
					eq(invitation.status, "pending"),
				),
			);

		return {
			userId: createdUser.id,
			email: createdUser.email,
			role,
		};
	});
};

export const updateUser = async (userId: string, userData: Partial<User>) => {
	// Validate email if it's being updated
	if (userData.email !== undefined) {
		if (!userData.email || userData.email.trim() === "") {
			throw new Error("Email is required and cannot be empty");
		}

		// Basic email format validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(userData.email)) {
			throw new Error("Please enter a valid email address");
		}
	}

	const userResult = await db
		.update(user)
		.set({
			...userData,
		})
		.where(eq(user.id, userId))
		.returning()
		.then((res) => res[0]);

	return userResult;
};

export const createApiKey = async (
	userId: string,
	input: {
		name: string;
		expiresIn?: number;
		metadata: {
			organizationId: string;
		};
	},
) => {
	const result = await auth.createApiKey({
		body: {
			name: input.name,
			expiresIn: input.expiresIn,
			userId,
		},
	});

	if (input.metadata) {
		await db
			.update(apikey)
			.set({ metadata: JSON.stringify(input.metadata) })
			.where(eq(apikey.id, result.id));
	}

	return result;
};
