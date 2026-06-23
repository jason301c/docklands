import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "@/server/core/db";
import {
	type AuditAction,
	type AuditResourceType,
	auditLog,
} from "@/server/core/db/schema";
import { logger } from "@/server/core/lib/logger";

export type { AuditAction, AuditResourceType };

export interface CreateAuditLogInput {
	organizationId: string;
	userId: string;
	userEmail: string;
	userRole: string;
	action: AuditAction;
	resourceType: AuditResourceType;
	resourceId?: string;
	resourceName?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Append an audit entry. Deliberately swallows its own errors: audit logging
 * must never break the operation it records (routers `await audit(...)` inline).
 */
export const createAuditLog = async (input: CreateAuditLogInput) => {
	try {
		await db.insert(auditLog).values({
			organizationId: input.organizationId,
			userId: input.userId,
			userEmail: input.userEmail,
			userRole: input.userRole,
			action: input.action,
			resourceType: input.resourceType,
			resourceId: input.resourceId ?? null,
			resourceName: input.resourceName ?? null,
			metadata: input.metadata ? JSON.stringify(input.metadata) : null,
		});
	} catch (error) {
		logger.warn({ error, action: input.action }, "Failed to write audit log");
	}
};

export interface GetAuditLogsInput {
	organizationId: string;
	userId?: string;
	userEmail?: string;
	resourceName?: string;
	action?: AuditAction;
	resourceType?: AuditResourceType;
	from?: Date;
	to?: Date;
	limit?: number;
	offset?: number;
}

export const getAuditLogs = async (input: GetAuditLogsInput) => {
	const filters = [eq(auditLog.organizationId, input.organizationId)];
	if (input.userId) filters.push(eq(auditLog.userId, input.userId));
	if (input.userEmail) filters.push(eq(auditLog.userEmail, input.userEmail));
	if (input.resourceName) {
		filters.push(ilike(auditLog.resourceName, `%${input.resourceName}%`));
	}
	if (input.action) filters.push(eq(auditLog.action, input.action));
	if (input.resourceType) {
		filters.push(eq(auditLog.resourceType, input.resourceType));
	}
	if (input.from) filters.push(gte(auditLog.createdAt, input.from));
	if (input.to) filters.push(lte(auditLog.createdAt, input.to));

	const where = and(...filters);
	const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
	const offset = Math.max(input.offset ?? 0, 0);

	const [logs, totalRow] = await Promise.all([
		db.query.auditLog.findMany({
			where,
			orderBy: [desc(auditLog.createdAt)],
			limit,
			offset,
		}),
		db.select({ value: count() }).from(auditLog).where(where),
	]);

	return { logs, total: totalRow[0]?.value ?? 0 };
};
