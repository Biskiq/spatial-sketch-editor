/**
 * The D8a audit must never invent compatibility from a parsed field.
 *
 * These tests hold the three review-critical behaviours: JSON and TypeScript
 * records are read structurally (no neighbouring field), dynamic fixture
 * construction is `indeterminate` rather than a false match, and a skipped or
 * failed database is `incomplete`, not cleared.
 */
import { describe, expect, it } from 'vitest';

import {
	classifyRecord,
	gateFor,
	parseJsonRecords,
	parseTypeScriptRecords,
} from '../../../tools/audit/shipped-asset-resources.mjs';

const CHAIR_REVISION =
	'sha256-480698dafa0c4d17960db4d218e7db462a327ea86a8e7d22a8f49fb25ab6ff9e';
const CLOCK_REVISION =
	'sha256-c44bfabd45da819470038502130b56f7bc6863daaadc0d48909c9d14e6361420';

describe('shipped-asset audit parsing', () => {
	it('keeps adjacent JSON records separate', () => {
		const records = parseJsonRecords(
			'fixture.json',
			JSON.stringify({
				units: {
					resources: {
						data: {
							resources: [
								{
									kind: 'asset',
									id: 'paris-salon-chair',
									contentRevision: CHAIR_REVISION,
									pin: null,
									unresolved: null,
								},
								{
									kind: 'asset',
									id: 'paris-grandfather-clock',
									pin: null,
									unresolved: null,
								},
							],
						},
					},
				},
			}),
		);

		expect(records.map((record) => [record.assetId, record.classification])).toEqual([
			['paris-salon-chair', 'matches'],
			['paris-grandfather-clock', 'no-revision'],
		]);
		expect(records[1]?.contentRevision).toBeNull();
	});

	it('reads a pin hash when contentRevision is null, as the closure validator does', () => {
		expect(
			classifyRecord({
				assetId: 'paris-grandfather-clock',
				contentRevision: null,
				pinHash: CLOCK_REVISION,
				unresolved: null,
				dynamic: false,
			}),
		).toBe('matches');
		expect(
			classifyRecord({
				assetId: 'paris-grandfather-clock',
				contentRevision: CHAIR_REVISION,
				pinHash: CLOCK_REVISION,
				unresolved: null,
				dynamic: false,
			}),
		).toBe('differs');
	});

	it('does not borrow fields across TypeScript object literals', () => {
		const records = parseTypeScriptRecords(
			'fixture.ts',
			[
				`const first = { kind: 'asset', id: 'paris-salon-chair', contentRevision: '${CHAIR_REVISION}', pin: null, unresolved: null };`,
				`const second = { kind: 'asset', id: 'paris-grandfather-clock', pin: null, unresolved: null };`,
			].join('\n'),
		);

		expect(records.map((record) => [record.assetId, record.classification])).toEqual([
			['paris-salon-chair', 'matches'],
			['paris-grandfather-clock', 'no-revision'],
		]);
	});

	it('marks a dynamic fixture expression indeterminate', () => {
		const records = parseTypeScriptRecords(
			'fixture.ts',
			`const record = { kind: 'asset', id: 'paris-salon-chair', contentRevision: revisionFor('chair'), pin: null, unresolved: null };`,
		);

		expect(records).toHaveLength(1);
		expect(records[0]?.classification).toBe('indeterminate');
		expect(records[0]?.reason).toMatch(/contentRevision is a dynamic expression/);
	});

	it('accounts for the production helper without claiming an unpinned revision', () => {
		const records = parseTypeScriptRecords(
			'fixture.ts',
			`const entry = shippedModelResourceEntry(catalogueRecord.assetId);`,
		);

		expect(records).toHaveLength(1);
		expect(records[0]?.classification).toBe('production-helper');
		expect(records[0]?.reason).toMatch(/derives its pinned revision/);
	});
});

describe('shipped-asset audit gate', () => {
	it('distinguishes a skipped database from a cleared gate', () => {
		expect(gateFor([], { status: 'skipped', reason: 'DATABASE_URL is not set' }).gate).toBe(
			'incomplete',
		);
		expect(gateFor([], { status: 'complete', records: [] }).gate).toBe('cleared');
	});

	it('distinguishes a failed database from a cleared gate', () => {
		const result = gateFor([], { status: 'failed', reason: 'psql: connection refused' });
		expect(result.gate).toBe('incomplete');
		expect(result.incompleteReasons).toContain('database audit failed: psql: connection refused');
	});

	it('is blocked by an incompatible record and incomplete by an indeterminate one', () => {
		expect(
			gateFor([{ classification: 'differs' }], { status: 'complete', records: [] }).gate,
		).toBe('blocked');
		expect(
			gateFor([{ classification: 'indeterminate' }], { status: 'complete', records: [] }).gate,
		).toBe('incomplete');
	});
});
