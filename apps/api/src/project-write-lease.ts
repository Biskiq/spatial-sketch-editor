import { randomUUID } from 'node:crypto';

import { UNIT_ENVELOPE_SOURCE_FORMAT } from '@portfolio/project-model/units';

import type { DatabasePool } from './database.js';
import { ProjectNotFoundError, queryRows, withTransaction } from './project-persistence.js';

/**
 * The largest approved-write request is a 50 MiB source set plus a 25 MiB
 * derivative. The 180 second route cap budgets this 75 MiB at 1 MiB/s (75 s),
 * leaving over 90 s for validation, object-store RTT/retries, and finalization.
 * Render's current HTTP response limit is substantially longer; this explicit
 * Fastify route bound is the lifecycle fence, not the platform timeout.
 */
export const PROJECT_WRITE_HANDLER_TIMEOUT_MS = 180_000;
/** Abort writes before the route handler bound, with time for cleanup/finalize checks. */
export const PROJECT_WRITE_LEASE_DEADLINE_MS = 170_000;
export const PROJECT_WRITE_RENEWAL_INTERVAL_MS = 2_000;
export const PROJECT_WRITE_ABORT_MARGIN_MS = 5_000;

export type ProjectLifecyclePolicy = {
	handlerTimeoutMs: number;
	leaseDeadlineMs: number;
	renewalIntervalMs: number;
	abortMarginMs: number;
	clock: () => Date;
};

export const DEFAULT_PROJECT_LIFECYCLE_POLICY: ProjectLifecyclePolicy = {
	handlerTimeoutMs: PROJECT_WRITE_HANDLER_TIMEOUT_MS,
	leaseDeadlineMs: PROJECT_WRITE_LEASE_DEADLINE_MS,
	renewalIntervalMs: PROJECT_WRITE_RENEWAL_INTERVAL_MS,
	abortMarginMs: PROJECT_WRITE_ABORT_MARGIN_MS,
	clock: () => new Date()
};

export function resolveProjectLifecyclePolicy(
	overrides: Partial<ProjectLifecyclePolicy> = {}
): ProjectLifecyclePolicy {
	const policy = { ...DEFAULT_PROJECT_LIFECYCLE_POLICY, ...overrides };
	if (
		!Number.isSafeInteger(policy.handlerTimeoutMs) ||
		!Number.isSafeInteger(policy.leaseDeadlineMs) ||
		!Number.isSafeInteger(policy.renewalIntervalMs) ||
		!Number.isSafeInteger(policy.abortMarginMs) ||
		policy.handlerTimeoutMs <= 0 ||
		policy.leaseDeadlineMs <= 0 ||
		policy.leaseDeadlineMs >= policy.handlerTimeoutMs ||
		policy.renewalIntervalMs <= 0 ||
		policy.renewalIntervalMs >= policy.leaseDeadlineMs ||
		policy.abortMarginMs <= 0
	) {
		throw new Error('Invalid project lifecycle timeout policy');
	}
	return policy;
}

export function projectCleanupBoundMs(policy: ProjectLifecyclePolicy): number {
	return policy.handlerTimeoutMs + policy.renewalIntervalMs + policy.abortMarginMs;
}

export class ProjectWriteAbortedError extends Error {
	readonly code = 'project-write-revoked';

	constructor(message = 'The project write was stopped because its lease was revoked or expired') {
		super(message);
		this.name = 'ProjectWriteAbortedError';
	}
}

export type ProjectWriteContext = {
	leaseId: string;
	signal: AbortSignal;
	assertActive(): void;
};

/**
 * Start one durable lease before a project-owned object write. Renewal fails
 * closed: a revoked row, a missed hard deadline, or a database error aborts the
 * request signal, which is passed through the object-store adapter.
 */
export async function withProjectWriteLease<T>(
	pool: DatabasePool,
	ownerId: string,
	projectId: string,
	work: (context: ProjectWriteContext) => Promise<T>,
	options: { parentSignal?: AbortSignal; policy?: ProjectLifecyclePolicy } = {}
): Promise<T> {
	const policy = options.policy ?? DEFAULT_PROJECT_LIFECYCLE_POLICY;
	if (options.parentSignal?.aborted) throw new ProjectWriteAbortedError();
	const leaseId = randomUUID();
	await withTransaction(pool, async (db) => {
		const project = await queryRows<{ id: unknown }>(
			db,
			`SELECT p.id
FROM projects p
WHERE p.id = $1 AND p.owner_id = $2
	AND EXISTS (
		SELECT 1 FROM project_versions v
		WHERE v.project_id = p.id AND v.source_format = $3
	)
FOR KEY SHARE`,
			[projectId, ownerId, UNIT_ENVELOPE_SOURCE_FORMAT]
		);
		if (!project[0]) throw new ProjectNotFoundError();
		await db.query(
			`INSERT INTO project_write_leases (
	id, project_id, owner_id, started_at, heartbeat_at, deadline_at
)
VALUES ($1::uuid, $2, $3, clock_timestamp(), clock_timestamp(),
	clock_timestamp() + ($4::double precision * interval '1 millisecond'))`,
			[leaseId, projectId, ownerId, policy.leaseDeadlineMs]
		);
	});

	const controller = new AbortController();
	const abort = (error: ProjectWriteAbortedError) => {
		if (!controller.signal.aborted) controller.abort(error);
	};
	const onParentAbort = () => abort(new ProjectWriteAbortedError('The request was cancelled or exceeded its handler deadline'));
	options.parentSignal?.addEventListener('abort', onParentAbort, { once: true });
	if (options.parentSignal?.aborted) onParentAbort();
	const assertActive = () => {
		if (controller.signal.aborted) {
			const reason = controller.signal.reason;
			throw reason instanceof ProjectWriteAbortedError ? reason : new ProjectWriteAbortedError();
		}
	};

	// The lease's SQL deadline starts before this local timer. Subtract the abort
	// margin so local cancellation always precedes the durable database deadline.
	const deadlineTimer = setTimeout(
		() => abort(new ProjectWriteAbortedError('The project write exceeded its fixed lease deadline')),
		Math.max(1, policy.leaseDeadlineMs - policy.abortMarginMs)
	);
	let renewalPending = false;
	const heartbeatTimer = setInterval(() => {
		if (renewalPending || controller.signal.aborted) return;
		renewalPending = true;
		void renewProjectWriteLease(pool, leaseId)
			.then((renewed) => {
				if (!renewed) abort(new ProjectWriteAbortedError('The project write lease was revoked or reached its deadline'));
			})
			.catch(() => abort(new ProjectWriteAbortedError('The project write lease could not be renewed')))
			.finally(() => {
				renewalPending = false;
			});
	}, policy.renewalIntervalMs);

	let value: T | undefined;
	let operationError: unknown;
	try {
		assertActive();
		value = await work({ leaseId, signal: controller.signal, assertActive });
		assertActive();
	} catch (error) {
		operationError = error;
	} finally {
		clearTimeout(deadlineTimer);
		clearInterval(heartbeatTimer);
		options.parentSignal?.removeEventListener('abort', onParentAbort);
		try {
			await pool.query(
				`UPDATE project_write_leases
SET released_at = COALESCE(released_at, clock_timestamp())
WHERE id = $1::uuid AND released_at IS NULL`,
				[leaseId]
			);
		} catch (error) {
			if (operationError === undefined) operationError = error;
		}
	}
	if (operationError !== undefined) throw operationError;
	return value as T;
}

async function renewProjectWriteLease(pool: DatabasePool, leaseId: string): Promise<boolean> {
	const rows = await queryRows<{ id: unknown }>(
		pool,
		`UPDATE project_write_leases
SET heartbeat_at = clock_timestamp()
WHERE id = $1::uuid AND revoked_at IS NULL AND released_at IS NULL
	AND deadline_at > clock_timestamp()
RETURNING id`,
		[leaseId]
	);
	return rows.length === 1;
}

/**
 * Serialize operations that share deterministic object keys without holding a
 * project row lock through object-store I/O. The scope/key pair is hashed by
 * PostgreSQL; a collision only adds serialization and cannot weaken ownership.
 */
export async function withProjectAdvisoryLock<T>(
	pool: DatabasePool,
	scope: string,
	key: string,
	work: () => Promise<T>
): Promise<T> {
	if (!pool.connect) throw new Error('Database transactions are unavailable');
	const db = await pool.connect();
	let locked = false;
	let lockError: Error | undefined;
	let workError: unknown;
	let value: T | undefined;
	try {
		await db.query('SELECT pg_advisory_lock(hashtext($1), hashtext($2))', [scope, key]);
		locked = true;
		value = await work();
	} catch (error) {
		workError = error;
	} finally {
		if (locked) {
			try {
				await db.query('SELECT pg_advisory_unlock(hashtext($1), hashtext($2))', [scope, key]);
			} catch (error) {
				lockError = error instanceof Error ? error : new Error('Could not release PostgreSQL advisory lock');
			}
		}
		const failedLockQuery = !locked && workError instanceof Error ? workError : undefined;
		db.release(lockError ?? failedLockQuery);
	}
	if (workError !== undefined) throw workError;
	if (lockError) throw lockError;
	return value as T;
}
