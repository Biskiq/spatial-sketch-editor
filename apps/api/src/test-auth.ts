import { timingSafeEqual } from 'node:crypto';

import { isSessionUserId } from './auth.js';

/**
 * P22 test-auth seam — deterministic automation identities.
 *
 * Test-only issuer in front of the existing session adapter: it replaces
 * only the password ceremony and then creates the exact session
 * representation the local login creates (`userId` in secure-session).
 * Ownership, authorization, session validation and persistence rules are
 * untouched — they only ever see a normal user id.
 *
 * Isolation is structural: the route is registered only when the server is
 * constructed with `testAuth`, which production configuration never sets.
 */
export type TestAuthOptions = {
	/** Bearer secret; compared in constant time, never logged. */
	secret: string;
};

/**
 * Allowlisted automation keys → normal app user ids. The historical `google:`
 * namespace is retained for fixture compatibility; the `e2e-` infix cannot
 * collide with the numeric subject values used by the former provider flow.
 */
const TEST_AUTH_USERS = {
	'agent-admin': 'google:e2e-agent-admin',
	'agent-user-a': 'google:e2e-agent-user-a',
	'agent-user-b': 'google:e2e-agent-user-b'
} as const;

export type TestAuthUserKey = keyof typeof TEST_AUTH_USERS;

export function resolveTestAuthUserId(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const userId: string | undefined = (TEST_AUTH_USERS as Record<string, string>)[value];
	if (!userId || !isSessionUserId(userId)) return null;
	return userId;
}

export function isValidTestAuthSecret(provided: unknown, expected: string): boolean {
	if (typeof provided !== 'string' || provided.length === 0 || expected.length === 0) return false;
	const a = new Uint8Array(Buffer.from(provided, 'utf8'));
	const b = new Uint8Array(Buffer.from(expected, 'utf8'));
	return a.length === b.length && timingSafeEqual(a, b);
}

/** Strict `Bearer <token>` extraction; anything else is unauthenticated. */
export function readTestAuthBearer(header: unknown): string | null {
	if (typeof header !== 'string') return null;
	const parts = header.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) return null;
	return parts[1];
}

/** Exact `{ user }` body; extra keys are rejected per API convention. */
export function readTestAuthTarget(body: unknown): { user: string } | null {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
	if (Object.keys(body).length !== 1) return null;
	const user = (body as Record<string, unknown>).user;
	if (typeof user !== 'string' || user.length === 0) return null;
	return { user };
}
