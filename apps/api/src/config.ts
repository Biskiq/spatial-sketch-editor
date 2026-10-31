export type ApiConfig = {
	databaseUrl: string;
	port: number;
	editorOrigin?: string;
	apiOrigin?: string;
	sessionKey?: Buffer;
	/**
	 * Comma-separated trusted proxy addresses/CIDRs (or a proxy-addr preset).
	 * Unset means forwarded headers are ignored; see `createApp`'s trustProxy.
	 */
	trustProxy?: string;
	r2Endpoint: string;
	r2Bucket: string;
	/**
	 * Deployment-owned object-key namespace. Every asset key starts with
	 * `projects/<namespace>/`, so a purge can refuse a bucket that also holds
	 * another deployment's app-shaped keys.
	 */
	r2ObjectNamespace: string;
	r2AccessKeyId: string;
	r2SecretAccessKey: string;
	/**
	 * Optional bearer secret enabling the test-only authentication seam.
	 * Absent by default (fail closed). Never set this on production — it is
	 * read here only so local/CI API instances can mint automation sessions
	 * without registering local credentials. Never a PUBLIC_* variable.
	 */
	testAuthSecret?: string;
};

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

function readDatabaseUrl(value: string | undefined): string {
	const databaseUrl = value?.trim();
	if (!databaseUrl) throw new ConfigError('DATABASE_URL is required');

	try {
		const url = new URL(databaseUrl);
		if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
			throw new Error();
		}
	} catch {
		throw new ConfigError('DATABASE_URL must be a PostgreSQL connection URL');
	}

	return databaseUrl;
}

function readPort(value: string | undefined): number {
	const portText = value?.trim();
	if (!portText) throw new ConfigError('PORT is required');

	if (!/^\d+$/.test(portText)) {
		throw new ConfigError('PORT must be an integer between 1 and 65535');
	}

	const port = Number(portText);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new ConfigError('PORT must be an integer between 1 and 65535');
	}

	return port;
}

function readOrigin(
	value: string | undefined,
	name: string,
	required = false,
	allowPath = false
): string | undefined {
	const origin = value?.trim();
	if (!origin) {
		if (required) throw new ConfigError(`${name} is required`);
		return undefined;
	}
	try {
		const url = new URL(origin);
		if (!['http:', 'https:'].includes(url.protocol) || (!allowPath && url.pathname !== '/') || url.search || url.hash) {
			throw new Error();
		}
		return allowPath ? `${url.origin}${url.pathname.replace(/\/+$/, '')}` : url.origin;
	} catch {
		throw new ConfigError(`${name} must be an HTTP(S) origin`);
	}
}

function readRequired(value: string | undefined, name: string): string {
	const result = value?.trim();
	if (!result) throw new ConfigError(`${name} is required`);
	return result;
}

function readR2Endpoint(value: string | undefined): string {
	const endpoint = readRequired(value, 'R2_ENDPOINT');
	try {
		const url = new URL(endpoint);
		if (
			url.protocol !== 'https:' ||
			!url.hostname ||
			url.username ||
			url.password ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		) {
			throw new Error();
		}
		return url.origin;
	} catch {
		throw new ConfigError('R2_ENDPOINT must be a credential-free HTTPS URL');
	}
}

function readTestAuthSecret(value: string | undefined): string | undefined {
	const secret = value?.trim();
	if (!secret) return undefined;
	if (secret.length < 16) throw new ConfigError('E2E_TEST_AUTH_SECRET must be at least 16 characters');
	return secret;
}

function readSessionKey(value: string | undefined): Buffer {
	const encoded = readRequired(value, 'SESSION_KEY');
	const key = /^[0-9a-f]{64}$/i.test(encoded)
		? Buffer.from(encoded, 'hex')
		: Buffer.from(encoded, 'base64');
	if (key.length !== 32) {
		throw new ConfigError('SESSION_KEY must be a 32-byte base64 or hex key');
	}
	return key;
}

function readTrustProxy(value: string | undefined): string | undefined {
	const proxies = value?.split(',').map((entry) => entry.trim()).filter(Boolean);
	return proxies && proxies.length > 0 ? proxies.join(',') : undefined;
}

function readObjectNamespace(value: string | undefined): string {
	const namespace = readRequired(value, 'R2_OBJECT_NAMESPACE');
	if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(namespace)) {
		throw new ConfigError(
			'R2_OBJECT_NAMESPACE must be 1-32 lowercase letters, digits or hyphens and start with a letter or digit'
		);
	}
	return namespace;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
	const databaseUrl = readDatabaseUrl(env.DATABASE_URL);
	const port = readPort(env.PORT);
	const editorOrigin = readOrigin(env.EDITOR_ORIGIN, 'EDITOR_ORIGIN', true)!;
	const apiOrigin = readOrigin(env.API_ORIGIN ?? env.RENDER_EXTERNAL_URL, 'API_ORIGIN', false, true);
	return {
		databaseUrl,
		port,
		editorOrigin,
		...(apiOrigin ? { apiOrigin } : {}),
		sessionKey: readSessionKey(env.SESSION_KEY),
		trustProxy: readTrustProxy(env.TRUST_PROXY),
		r2Endpoint: readR2Endpoint(env.R2_ENDPOINT),
		r2Bucket: readRequired(env.R2_BUCKET, 'R2_BUCKET'),
		r2ObjectNamespace: readObjectNamespace(env.R2_OBJECT_NAMESPACE),
		r2AccessKeyId: readRequired(env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID'),
		r2SecretAccessKey: readRequired(env.R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY'),
		testAuthSecret: readTestAuthSecret(env.E2E_TEST_AUTH_SECRET)
	};
}
