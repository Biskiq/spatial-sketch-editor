/**
 * P23B.5 §0.6 — the deliberate re-record path for the reuse ratchet.
 *
 * The gate (`p23b5-reuse-budget.test.ts`) fails when reuse drifts; this file
 * covers the only sanctioned way to accept that drift: `npm run reuse:record`,
 * mirroring how `bench:record` is the only writer of the P23B.0 baseline. The
 * recorder must refuse a missing reason, refuse a dirty tree, and refuse a
 * measurement that breaks an absolute invariant — so the command can never bless
 * an incoherent counter set. Nothing here writes the committed record.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ratchet from '../../../../../docs/roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json';
import {
	REUSE_RATCHET_PATH,
	isUsableRecordReason,
	measureReuseRatchetCase,
	parseReuseRecordArgs,
	readReuseRatchet,
	recordReuseRatchet,
	reuseRatchetCaseOf,
	serializeReuseRatchet,
	type ReuseRatchetMeasurement,
	type ReuseRatchetRecord
} from '$lib/bench/p23b5-reuse-ratchet';

const here = dirname(fileURLToPath(import.meta.url));
const committed = ratchet as ReuseRatchetRecord;
const CLEAN = { clean: true, headSha: 'abc1234' };
const REASON = 'the proposal stage now samples the Walls it rebuilds';

/** The real measurement of the first recorded case, taken once and shared. */
let realMeasurement: ReuseRatchetMeasurement | undefined;
function measured(): ReuseRatchetMeasurement {
	realMeasurement ??= measureReuseRatchetCase(committed.cases[0]!);
	return realMeasurement;
}

describe('P23B.5 reuse ratchet — the recorder', () => {
	it('requires a reason and rejects a placeholder, a typo or a missing value', () => {
		expect(() => parseReuseRecordArgs([])).toThrow(/requires --reason/);
		expect(() => parseReuseRecordArgs(['--reason'])).toThrow(/requires --reason/);
		expect(() => parseReuseRecordArgs(['--dry-run'])).toThrow(/does not take --dry-run/);
		expect(parseReuseRecordArgs(['--reason', REASON])).toEqual({ reason: REASON });
		expect(parseReuseRecordArgs([`--reason=${REASON}`])).toEqual({ reason: REASON });

		for (const bad of ['', '   ', 'todo', 'TBD', 'wip', 'n/a', 'too short']) {
			expect(isUsableRecordReason(bad), `"${bad}" is not a reason`).toBe(false);
		}
		expect(isUsableRecordReason('the gesture scope now owns the reverse traversal too')).toBe(true);
	});

	it('refuses to write without a usable reason, before it reads the tree or the drag', () => {
		expect(() =>
			recordReuseRatchet({ reason: 'tbd', record: committed, treeState: CLEAN, measurements: [measured()] })
		).toThrow(/needs a reason/);
	});

	it('refuses a dirty source tree, so recordedCommit cannot name the wrong state', () => {
		expect(() =>
			recordReuseRatchet({
				reason: REASON,
				record: committed,
				treeState: { clean: false, headSha: 'abc1234' },
				measurements: [measured()]
			})
		).toThrow(/clean source tree/);
	});

	it('refuses an incoherent measurement instead of blessing it', () => {
		const broken = structuredClone(measured());
		broken.preflightMissesPerMove = [0, 0, 0];
		expect(() =>
			recordReuseRatchet({ reason: REASON, record: committed, treeState: CLEAN, measurements: [broken] })
		).toThrow(/owns exactly the preflight requests/);
		expect(() =>
			recordReuseRatchet({ reason: REASON, record: committed, treeState: CLEAN, measurements: [] })
		).toThrow(/no cases/);
	});

	it('keeps the hand-written policy prose and records the reason, date and commit', () => {
		const at = new Date('2026-09-26T12:00:00.000Z');
		const next = recordReuseRatchet({
			reason: REASON,
			record: committed,
			treeState: CLEAN,
			measurements: [measured()],
			at
		});
		expect(next.identityScope).toBe(committed.identityScope);
		expect(next.changePolicy).toBe(committed.changePolicy);
		expect(next.outOfScope).toBe(committed.outOfScope);
		expect(next.method).toEqual(committed.method);
		expect(next.recordedReason).toBe(REASON);
		expect(next.recordedAt).toBe('2026-09-26');
		expect(next.recordedCommit).toBe('abc1234');
		expect(next.recordedBy).toBe('npm run reuse:record');
		expect(next.recordedTree).toBe('clean');
		expect(next.cases).toEqual([reuseRatchetCaseOf(measured())]);
	});

	it('default measurement reproduces the committed cases exactly', () => {
		// The end-to-end statement: re-recording on today's tree changes the reason
		// and the commit, never a count.
		const next = recordReuseRatchet({ reason: REASON, record: committed, treeState: CLEAN });
		expect(next.cases).toEqual(committed.cases);
	});

	it('serializes stably and round-trips', () => {
		const text = serializeReuseRatchet(committed);
		expect(text).toBe(JSON.stringify(committed, null, 2) + '\n');
		expect(JSON.parse(text)).toEqual(committed);
	});

	it('points the recorder at the same file the gate imports', () => {
		expect(REUSE_RATCHET_PATH.endsWith('p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json')).toBe(
			true
		);
		expect(readReuseRatchet(REUSE_RATCHET_PATH)).toEqual(committed);
	});

	it('never writes the record from a measurement or a read', () => {
		const before = readFileSync(REUSE_RATCHET_PATH, 'utf8');
		measureReuseRatchetCase(committed.cases[1]!);
		readReuseRatchet();
		expect(readFileSync(REUSE_RATCHET_PATH, 'utf8')).toBe(before);
	});

	it('leaves the CLI as the only writer, and only through the reason-checked recorder', () => {
		const cli = readFileSync(resolve(here, '../../../src/lib/bench/p23b5-reuse-ratchet.cli.ts'), 'utf8');
		// The reason is parsed from argv and handed to the recorder that validates
		// it; the CLI writes once, to the recorded path, and nowhere else.
		expect(cli).toContain('parseReuseRecordArgs(process.argv.slice(2))');
		expect(cli).toContain('recordReuseRatchet({');
		expect(cli.match(/writeFileSync\(/g)).toHaveLength(1);
		expect(cli).toContain('writeFileSync(REUSE_RATCHET_PATH');
		expect(readFileSync(resolve(here, 'p23b5-reuse-budget.test.ts'), 'utf8')).not.toContain('writeFileSync');
	});
});
