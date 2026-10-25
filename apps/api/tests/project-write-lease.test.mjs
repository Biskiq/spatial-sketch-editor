import assert from 'node:assert/strict';
import test from 'node:test';

import {
	ProjectWriteAbortedError,
	resolveProjectLifecyclePolicy,
	withProjectWriteLease
} from '../dist/project-write-lease.js';

function scriptedPool({ afterProjectRead, afterInsert, beforeCommit } = {}) {
	const events = [];
	return {
		events,
		async connect() {
			return {
				async query(text) {
					events.push(text);
					if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
						if (text === 'COMMIT') await beforeCommit?.();
						return { rows: [] };
					}
					if (text.includes('SELECT p.id')) {
						await afterProjectRead?.();
						return { rows: [{ id: 'project-1' }] };
					}
					if (text.includes('INSERT INTO project_write_leases')) {
						await afterInsert?.();
						return { rows: [] };
					}
					throw new Error(`Unexpected client query: ${text}`);
				},
				release() {
					events.push('release-client');
				}
			};
		},
		async query(text) {
			events.push(text);
			if (text.includes('UPDATE project_write_leases')) return { rows: [] };
			throw new Error(`Unexpected pool query: ${text}`);
		},
		async end() {}
	};
}

function fakePolicy(time) {
	return resolveProjectLifecyclePolicy({
		handlerTimeoutMs: 1_000,
		leaseDeadlineMs: 100,
		renewalIntervalMs: 10,
		abortMarginMs: 10,
		monotonicClock: () => time.now
	});
}

test('lease acquisition latency consumes the fixed lifetime and rejects before inserting after expiry', async () => {
	const time = { now: 0 };
	const pool = scriptedPool({
		afterProjectRead: () => {
			time.now = 95;
		}
	});
	let workStarted = false;

	await assert.rejects(
		withProjectWriteLease(pool, 'owner-1', 'project-1', async () => {
			workStarted = true;
		}, { policy: fakePolicy(time) }),
		ProjectWriteAbortedError
	);

	assert.equal(workStarted, false);
	assert.equal(pool.events.some((event) => event.includes('INSERT INTO project_write_leases')), false);
	assert.equal(pool.events.includes('release-client'), true);
});

test('a delayed commit response cannot grant a fresh local deadline or start writer work', async () => {
	const time = { now: 0 };
	const pool = scriptedPool({
		beforeCommit: () => {
			time.now = 95;
		}
	});
	let workStarted = false;

	await assert.rejects(
		withProjectWriteLease(pool, 'owner-1', 'project-1', async () => {
			workStarted = true;
		}, { policy: fakePolicy(time) }),
		ProjectWriteAbortedError
	);

	assert.equal(workStarted, false);
	assert.ok(pool.events.some((event) => event.includes('INSERT INTO project_write_leases')));
	assert.ok(pool.events.some((event) => event.includes('UPDATE project_write_leases')));
});

test('synchronous lease checks abort writes after an elapsed-time jump even if the timer has not fired', async () => {
	const time = { now: 0 };
	const pool = scriptedPool();
	let signal;
	let byteWriteStarted = false;

	await assert.rejects(
		withProjectWriteLease(pool, 'owner-1', 'project-1', async (lease) => {
			signal = lease.signal;
			time.now = 91;
			lease.assertActive();
			byteWriteStarted = true;
		}, { policy: fakePolicy(time) }),
		ProjectWriteAbortedError
	);

	assert.equal(signal.aborted, true);
	assert.equal(byteWriteStarted, false);
});
