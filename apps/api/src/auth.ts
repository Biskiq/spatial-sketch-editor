import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabasePool } from './database.js';

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

export async function findCredentials(pool: DatabasePool, username: string): Promise<{ user_id: string; password_hash: string } | undefined> {
	const result = await pool.query('SELECT user_id, password_hash FROM local_credentials WHERE username = $1', [username]) as { rows: { user_id: string; password_hash: string }[] };
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

/** DB-backed, shared across restarts and API workers; keys contain no passwords. */
export async function admitAuthAttempt(pool: DatabasePool, ip: string, username: string): Promise<boolean> {
	for (const [key, limit] of [[`ip:${ip}`, 30], [`name:${username}`, 10]] as const) {
		const result = await pool.query(`INSERT INTO auth_attempts (key, attempts, window_start)
VALUES ($1, 1, now())
ON CONFLICT (key) DO UPDATE SET
 attempts = CASE WHEN auth_attempts.window_start < now() - interval '15 minutes' THEN 1 ELSE auth_attempts.attempts + 1 END,
 window_start = CASE WHEN auth_attempts.window_start < now() - interval '15 minutes' THEN now() ELSE auth_attempts.window_start END
RETURNING attempts`, [key]) as { rows: { attempts: number }[] };
		if (result.rows[0]!.attempts > limit) return false;
	}
	await pool.query("DELETE FROM auth_attempts WHERE window_start < now() - interval '1 day'");
	return true;
}
