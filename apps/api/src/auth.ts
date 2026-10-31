import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabasePool } from './database.js';
import { withTransaction } from './project-persistence.js';

// OWASP's scrypt profile: N=2^17, r=8, p=1. At most one hash is admitted
// per API process by the route guard; async crypto never blocks the event loop.
const SCRYPT_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const PREFIX = 'scrypt-v1';
const DUMMY_HASH = `${PREFIX}$${'00'.repeat(16)}$${'00'.repeat(64)}`;

export function isSessionUserId(value: unknown): value is string {
	// Legacy ids remain session identities, never an external identity lookup.
	return typeof value === 'string' && /^(?:google:[\x21-\x7e]{1,255}|local:[0-9a-f-]{36})$/.test(value);
}

export function readCredentials(value: unknown): { username: string; password: string } | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	if (Object.keys(record).length !== 2 || typeof record.username !== 'string' || typeof record.password !== 'string') return null;
	if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(record.username) || record.password.length < 8 || record.password.length > 128) return null;
	return { username: record.username.toLowerCase(), password: record.password };
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, new Uint8Array(salt), 64, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	return `${PREFIX}$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
	const valid = typeof stored === 'string' && /^scrypt-v1\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored);
	const [, salt, expected] = (valid ? stored : DUMMY_HASH).split('$');
	const actual = await derive(password, Buffer.from(salt!, 'hex'));
	return timingSafeEqual(new Uint8Array(actual), new Uint8Array(Buffer.from(expected!, 'hex'))) && valid;
}

type AuthQuery = Pick<DatabasePool, 'query'>;

export async function findCredentials(db: AuthQuery, username: string): Promise<{ user_id: string; password_hash: string } | undefined> {
	const result = await db.query('SELECT user_id, password_hash FROM local_credentials WHERE username = $1', [username]) as { rows: { user_id: string; password_hash: string }[] };
	return result.rows[0];
}

export async function hasCredentials(pool: DatabasePool, userId: string): Promise<boolean> {
	const result = await pool.query('SELECT user_id FROM local_credentials WHERE user_id = $1', [userId]) as { rows: unknown[] };
	return result.rows.length > 0;
}

export async function enrollCredentials(pool: DatabasePool, credentials: { username: string; password: string }, existingUserId?: string): Promise<string> {
	if (!pool.connect) throw new Error('Authentication requires a transactional database');
	const passwordHash = await hashPassword(credentials.password);
	const userId = existingUserId ?? `local:${randomUUID()}`;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [userId]);
		await client.query('INSERT INTO local_credentials (user_id, username, password_hash) VALUES ($1, $2, $3)', [userId, credentials.username, passwordHash]);
		await client.query('COMMIT');
		return userId;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

/**
 * The credential failure budget is keyed by client source as well as by
 * username.
 *
 * A bare username bucket let anyone who knew a username burn that account's
 * budget and deny its owner login from every other source. The credential key
 * pairs the source address with the username instead; the source key alone
 * still bounds probing many usernames from one place. Keys contain no
 * passwords.
 *
 * Residual risk: a distributed attack is bounded per source, not globally per
 * account, so scrypt's cost is the remaining backstop. `request.ip` is the
 * socket peer unless `TRUST_PROXY` names the terminating proxy; behind a proxy
 * with that setting unset, every request shares the proxy address, so the source
 * budget becomes global and the credential key collapses back to a
 * username-targeted bucket. Shared NAT and IP rotation can likewise spread or
 * concentrate attempts across sources.
 */
const AUTH_SOURCE_LIMIT = 30;
const AUTH_CREDENTIAL_LIMIT = 10;

// The pre-correction `ip:` key is retained so existing source counters keep
// counting; only the global `name:` key is retired (its rows age out).
function authSourceKey(ip: string): string {
	return `ip:${ip}`;
}

/** `|` cannot occur in an IPv4/IPv6 literal or in the username grammar. */
function authCredentialKey(ip: string, username: string): string {
	return `credential:${ip}|${username}`;
}

type AuthAttemptKey = readonly [key: string, limit: number];

async function authAttemptsWithinLimit(db: AuthQuery, keys: readonly AuthAttemptKey[]): Promise<boolean> {
	const result = await db.query(
		`SELECT key, attempts FROM auth_attempts
WHERE key = ANY($1::text[]) AND window_start >= now() - interval '15 minutes'`,
		[keys.map(([key]) => key)]
	) as { rows: { key: string; attempts: number }[] };
	const used = new Map(result.rows.map((row) => [row.key, row.attempts] as const));
	return keys.every(([key, limit]) => (used.get(key) ?? 0) < limit);
}

/** One atomic increment inside the 15-minute window; returns the new count. */
async function consumeAuthAttempt(db: AuthQuery, key: string): Promise<number> {
	const result = await db.query(`INSERT INTO auth_attempts (key, attempts, window_start)
VALUES ($1, 1, now())
ON CONFLICT (key) DO UPDATE SET
 attempts = CASE WHEN auth_attempts.window_start < now() - interval '15 minutes' THEN 1 ELSE auth_attempts.attempts + 1 END,
 window_start = CASE WHEN auth_attempts.window_start < now() - interval '15 minutes' THEN now() ELSE auth_attempts.window_start END
RETURNING attempts`, [key]) as { rows: { attempts: number }[] };
	return result.rows[0]!.attempts;
}

/** Record one failed credential check. Successful paths never call this. */
async function recordAuthFailure(db: AuthQuery, ip: string, username: string): Promise<void> {
	for (const key of [authSourceKey(ip), authCredentialKey(ip, username)]) {
		await consumeAuthAttempt(db, key);
	}
	await db.query("DELETE FROM auth_attempts WHERE window_start < now() - interval '1 day'");
}

/**
 * A verified login clears this source's budget for this username, including
 * failures recorded just below the threshold. The source-wide budget is not
 * cleared: it counts failed logins and register/enroll attempts for every
 * username, so one valid account could otherwise reset the probing budget.
 */
async function clearAuthFailures(db: AuthQuery, ip: string, username: string): Promise<void> {
	await db.query('DELETE FROM auth_attempts WHERE key = $1', [authCredentialKey(ip, username)]);
}

/** Serialize every credential action that reads or changes one source budget. */
async function lockAuthSource(db: AuthQuery, ip: string): Promise<void> {
	await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [authSourceKey(ip)]);
}

export type LoginAttemptResult =
	| { readonly kind: 'limited' }
	| { readonly kind: 'invalid' }
	| { readonly kind: 'verified'; readonly userId: string };

/**
 * Admit, verify and record one login as a single serialized decision.
 *
 * The transaction-scoped advisory lock is keyed by the source, so every attempt
 * from one source is ordered across all API workers: a worker cannot verify
 * against a count that another worker is about to change. Both budgets are
 * source-scoped, so this one lock covers both. Verification holds the lock, so a
 * success never reserves an attempt and a failure can only be recorded after it
 * was actually observed; a success clears only its own credential key.
 */
export async function loginAttempt(
	pool: DatabasePool,
	ip: string,
	username: string,
	password: string
): Promise<LoginAttemptResult> {
	return withTransaction(pool, async (db) => {
		await lockAuthSource(db, ip);
		if (!await authAttemptsWithinLimit(db, [
			[authSourceKey(ip), AUTH_SOURCE_LIMIT],
			[authCredentialKey(ip, username), AUTH_CREDENTIAL_LIMIT]
		])) {
			return { kind: 'limited' };
		}
		const account = await findCredentials(db, username);
		if (!await verifyPassword(password, account?.password_hash)) {
			await recordAuthFailure(db, ip, username);
			return { kind: 'invalid' };
		}
		await clearAuthFailures(db, ip, username);
		return { kind: 'verified', userId: account!.user_id };
	});
}

/**
 * Register/enroll admission. These actions have no credential check whose
 * failure could be recorded, so the source attempt budget is consumed here.
 * They share login's transaction-scoped source lock so mixed actions cannot
 * race past the same threshold across API workers.
 */
export async function admitAuthAttempt(pool: DatabasePool, ip: string): Promise<boolean> {
	return withTransaction(pool, async (db) => {
		await lockAuthSource(db, ip);
		if (!await authAttemptsWithinLimit(db, [[authSourceKey(ip), AUTH_SOURCE_LIMIT]])) return false;
		await consumeAuthAttempt(db, authSourceKey(ip));
		await db.query("DELETE FROM auth_attempts WHERE window_start < now() - interval '1 day'");
		return true;
	});
}
