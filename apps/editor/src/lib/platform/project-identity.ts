/**
 * Cloud identity, auth and ids — deliberately free of the project model.
 *
 * `/` and `/projects` need sign-in, a minted project id and the typed persistence
 * error, but not envelope validation or units. Keeping these here means those
 * routes never pull the project-model barrel (and Three) into their first load.
 * `project-persistence.ts` re-exports every name so existing callers are unchanged.
 */
export type ProjectLoginIntent = 'projects' | 'save';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ProjectSession =
	| { authenticated: false }
	| { authenticated: true; user: { id: string } };

export type ProjectAuth = {
	getSession(signal?: AbortSignal): Promise<ProjectSession>;
	signIn: (intent?: ProjectLoginIntent) => void | Promise<void>;
	signOut: (signal?: AbortSignal) => Promise<void>;
};

export type ProjectPersistenceErrorCode =
	| 'configuration'
	| 'auth'
	| 'invalid'
	| 'not-found'
	| 'too-large'
	| 'network'
	| 'server'
	| 'conflict'
	| 'collision'
	| 'project-busy'
	| 'unpublish-first';

export class ProjectPersistenceError extends Error {
	constructor(
		readonly code: ProjectPersistenceErrorCode,
		message: string,
		readonly status?: number,
		/** The server's typed refusal, when it supplied one. */
		readonly serverCode?: string,
		readonly issues?: readonly { path: string; code: string; message: string }[]
	) {
		super(message);
		this.name = 'ProjectPersistenceError';
	}
}

function normalizeApiOrigin(origin: string): string {
	return origin.trim().replace(/\/+$/, '');
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
	return signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError');
}

function errorCodeForStatus(status: number): ProjectPersistenceErrorCode {
	if (status === 401 || status === 403) return 'auth';
	if (status === 404) return 'not-found';
	if (status === 409) return 'conflict';
	if (status === 413) return 'too-large';
	if (status >= 500) return 'server';
	return 'invalid';
}

async function requestJson(
	fetchImpl: FetchLike,
	origin: string,
	path: string,
	init: RequestInit,
	signal?: AbortSignal
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchImpl(`${origin}${path}`, {
			...init,
			credentials: 'include',
			signal,
			headers: {
				Accept: 'application/json',
				...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
				...(init.headers ?? {})
			}
		});
	} catch (error) {
		if (isAbort(error, signal)) throw error;
		throw new ProjectPersistenceError('network', 'Cloud request failed');
	}
	let body: unknown = null;
	if (response.status !== 204) {
		try {
			body = await response.json();
		} catch {
			// An empty error body is mapped by status below.
		}
	}
	if (response.ok) return body;
	throw new ProjectPersistenceError(
		errorCodeForStatus(response.status),
		`Cloud request failed (${response.status})`,
		response.status
	);
}

function readSession(value: unknown): ProjectSession {
	if (value !== null && typeof value === 'object') {
		const session = value as { authenticated?: unknown; user?: unknown };
		const user = session.user;
		if (session.authenticated === true && user !== null && typeof user === 'object') {
			const id = (user as { id?: unknown }).id;
			if (typeof id === 'string') return { authenticated: true, user: { id } };
		}
	}
	return { authenticated: false };
}

export function createProjectAuth(apiOrigin: string, fetchImpl?: FetchLike): ProjectAuth {
	const origin = normalizeApiOrigin(apiOrigin);
	const requestFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
	if (!origin || !requestFetch) {
		throw new ProjectPersistenceError('configuration', 'Cloud requests are unavailable');
	}

	return {
		getSession: (signal) =>
			requestJson(requestFetch, origin, '/auth/me', { method: 'GET' }, signal).then(readSession),
		signIn: (intent = 'projects') => {
			if (typeof window === 'undefined') throw new ProjectPersistenceError('configuration', 'Sign-in is unavailable');
			window.location.assign(`/login?intent=${encodeURIComponent(intent)}`);
		},
		signOut: (signal) =>
			requestJson(requestFetch, origin, '/auth/logout', { method: 'POST' }, signal).then(() => undefined)
	};
}

export function createProjectId(randomUUID: () => string = () => globalThis.crypto.randomUUID()): string {
	return `project:${randomUUID()}`;
}
