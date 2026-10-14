/**
 * API contract: process health, deployment configuration and shutdown.
 *
 * Split out of `api.test.mjs` by WP3T so one file owns one contract. Uses
 * fakes/stubs only — nothing here needs Postgres.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { createApp } from '../dist/app.js';
import { ConfigError, readConfig } from '../dist/config.js';
import { sanitizeDatabaseError } from '../dist/database.js';
import { installShutdownHandlers } from '../dist/shutdown.js';
import { startServer } from '../dist/server.js';

import { R2_ENV, stubPool } from './test-support.mjs';

test('liveness is independent of Postgres', async () => {
	let queries = 0;
	const app = createApp({
		pool: stubPool({ query: async () => queries++ }),
		logger: false
	});

	try {
		const response = await app.inject('/health/live');
		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.json(), { status: 'ok' });
		assert.equal(queries, 0);
	} finally {
		await app.close();
	}
});

test('readiness succeeds after SELECT 1', async () => {
	let statement;
	const app = createApp({
		pool: stubPool({ query: async (text) => (statement = text) }),
		logger: false
	});

	try {
		const response = await app.inject('/health/ready');
		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.json(), { status: 'ok' });
		assert.equal(statement, 'SELECT 1');
	} finally {
		await app.close();
	}
});

test('configuration validates deployment auth values without exposing secrets', async () => {
	assert.throws(
		() => readConfig({ PORT: '3000' }),
		(error) => error instanceof ConfigError && error.message === 'DATABASE_URL is required'
	);
	assert.throws(
		() => readConfig({ DATABASE_URL: 'https://user:secret@example.test/db', PORT: '3000' }),
		(error) =>
			error instanceof ConfigError &&
			error.message === 'DATABASE_URL must be a PostgreSQL connection URL' &&
			!error.message.includes('secret')
	);
	assert.throws(
		() => readConfig({ DATABASE_URL: 'postgres://user:secret@example.test/db', PORT: '0' }),
		(error) => error instanceof ConfigError && error.message.startsWith('PORT must be')
	);

	await assert.rejects(
		startServer({
			env: { DATABASE_URL: 'not-a-url', PORT: '3000' },
			pool: stubPool()
		}),
		(error) => error instanceof ConfigError
	);

	const key = Buffer.alloc(32, 9);
	const config = readConfig({
		DATABASE_URL: 'postgres://user@db.example.test/app',
		PORT: '3000',
		API_ORIGIN: 'https://editor.example.test/api/',
		EDITOR_ORIGIN: 'https://editor.example.test/',
		GOOGLE_CLIENT_ID: 'client-id',
		GOOGLE_CLIENT_SECRET: 'client-secret',
		SESSION_KEY: key.toString('base64'),
		...R2_ENV
	});
	assert.equal(config.databaseUrl, 'postgres://user@db.example.test/app');
	assert.equal(config.port, 3000);
	assert.equal(config.apiOrigin, 'https://editor.example.test/api');
	assert.equal(config.editorOrigin, 'https://editor.example.test');
	assert.equal(config.googleClientId, 'client-id');
	assert.equal(config.googleClientSecret, 'client-secret');
	assert.deepEqual(config.sessionKey, key);
	assert.equal(config.r2Endpoint, R2_ENV.R2_ENDPOINT);
	assert.equal(config.r2Bucket, R2_ENV.R2_BUCKET);
	assert.equal(config.r2AccessKeyId, R2_ENV.R2_ACCESS_KEY_ID);
	assert.equal(config.r2SecretAccessKey, R2_ENV.R2_SECRET_ACCESS_KEY);
	assert.throws(
		() => readConfig({
			DATABASE_URL: 'postgres://user@db.example.test/app',
			PORT: '3000',
			EDITOR_ORIGIN: 'https://editor.example.test',
			GOOGLE_CLIENT_ID: 'client-id',
			GOOGLE_CLIENT_SECRET: 'client-secret',
			SESSION_KEY: 'short'
		}),
		(error) => error instanceof ConfigError && !error.message.includes('short')
	);
	assert.throws(
		() => readConfig({
			DATABASE_URL: 'postgres://user@db.example.test/app',
			PORT: '3000',
			EDITOR_ORIGIN: 'https://editor.example.test',
			GOOGLE_CLIENT_ID: 'client-id',
			GOOGLE_CLIENT_SECRET: 'client-secret',
			SESSION_KEY: key.toString('base64'),
			...R2_ENV,
			R2_ENDPOINT: 'https://user:secret@r2.example.test'
		}),
		(error) => error instanceof ConfigError && error.message === 'R2_ENDPOINT must be a credential-free HTTPS URL' && !error.message.includes('secret')
	);
});

test('Fastify closes the pool once through the guarded signal path', async () => {
	let closes = 0;
	const app = createApp({
		pool: stubPool({ end: async () => closes++ }),
		logger: false
	});
	const signals = new EventEmitter();
	const closeOnce = installShutdownHandlers(app, signals);

	signals.emit('SIGTERM');
	signals.emit('SIGINT');
	await closeOnce();
	assert.equal(closes, 1);
});

test('database logs retain only safe error metadata', () => {
	const error = Object.assign(new Error('postgres://user:secret@example.test/db'), {
		code: 'ECONNREFUSED'
	});
	assert.deepEqual(sanitizeDatabaseError(error), { name: 'Error', code: 'ECONNREFUSED' });
});
