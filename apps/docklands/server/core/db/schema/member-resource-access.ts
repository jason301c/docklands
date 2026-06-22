import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { member, organization } from "./account";

/**
 * Normalized per-member resource access scoping. Replaces the legacy
 * `accessed*` text[] columns on the `member` row. Each row grants one member
 * access to one specific resource (workspace, environment, service, git
 * provider, or runtime worker). Empty set = no scoped access (deny by default
 * for non owner/admin roles), matching the previous array-allowlist semantics.
 */
export const memberResourceAccessType = [
	"workspace",
	"environment",
	"service",
	"gitProvider",
	"runtimeWorker",
] as const;

export type MemberResourceAccessType =
	(typeof memberResourceAccessType)[number];

export const memberResourceAccess = pgTable(
	"member_resource_access",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		memberId: text("member_id")
			.notNull()
			.references(() => member.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		resourceType: text("resource_type")
			.notNull()
			.$type<MemberResourceAccessType>(),
		resourceId: text("resource_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(t) => [
		index("memberResourceAccess_memberId_idx").on(t.memberId),
		index("memberResourceAccess_organizationId_idx").on(t.organizationId),
		unique("memberResourceAccess_member_resource_unique").on(
			t.memberId,
			t.resourceType,
			t.resourceId,
		),
	],
);

export const memberResourceAccessRelations = relations(
	memberResourceAccess,
	({ one }) => ({
		member: one(member, {
			fields: [memberResourceAccess.memberId],
			references: [member.id],
		}),
		organization: one(organization, {
			fields: [memberResourceAccess.organizationId],
			references: [organization.id],
		}),
	}),
);
