import { describe, expect, it } from 'vitest';
import { collectGesture, collectSessions, openTiming, pickIdentity, sessionLabel, typedLengthTiming, previewProvenance } from '../../../perf/lib/spot-measurement';
import type { LedgerRecord, PerfLedger } from '../../../perf/lib/ledger';

function record(name: string, time: number, detail: Record<string, unknown> = {}, kind: LedgerRecord['kind'] = 'mark'): LedgerRecord {
	return { name, time, detail, kind, sequence: 0 };
}
function ledger(records: LedgerRecord[]): PerfLedger {
	return { records, renderFrames: [
		{ surface: 'preview', sourceContentId: 'new', start: 13, end: 14, triangles: 1 },
		{ surface: 'stage', sourceContentId: 'old', start: 15, end: 16, triangles: 1 },
		{ surface: 'stage', sourceContentId: 'new', start: 17, end: 18, triangles: 0 },
		{ surface: 'stage', sourceContentId: 'new', start: 22, end: 24, triangles: 10 }
	], ticks: [15, 20, 30], longTasks: [], events: [], paints: {}, lcp: null, navigationStart: 0 };
}

describe('spot measurement wiring', () => {
	it('times open admission and the relevant architectural render separately', () => {
		const measured = openTiming(ledger([record('f2:open-requested', 5), record('f2:open-admitted', 12, { sourceContentId: 'new' })]), 0);
		expect(measured).toMatchObject({ editorMs: 7, renderedMs: 19, presentedMs: 25, rendered: 24, presented: 30 });
	});
	it('does not replace a missing typed marker with the pointer marker', () => {
		expect(typedLengthTiming(ledger([record('command:commit', 1), record('accepted-result', 12, { sourceContentId: 'new' }, 'result')]), 2, 'wall').editorMs).toBeNull();
	});
	it('appends extensions in the same gesture with a real eight-attempt cap', async () => {
		const calls: number[] = [];
		const rows = await collectGesture('M', 16.7, async (index) => {
			calls.push(index);
			return { editorMs: index === 0 ? 7.5 : 1, presentedMs: 10, automationMs: 2 };
		});
		expect(calls).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(rows.map((row) => row.editorMs)).toEqual([7.5, 1, 1, 1, 1, 1, 1, 1]);
	});
	it('keeps an outlier on extension and stops when it decides the result', async () => {
		const rows = await collectGesture('M', 16.7, async (index) => ({ editorMs: index === 4 ? 40 : 7.5, presentedMs: 10, automationMs: 2 }));
		expect(rows.map((row) => row.editorMs)).toEqual([7.5, 7.5, 7.5, 7.5, 40]);
	});
	it('extends for presentation margins too and preserves missing observations', async () => {
		expect(await collectGesture('M', 16.7, async () => ({ editorMs: 1, presentedMs: 18, automationMs: 2 }))).toHaveLength(8);
		const missing = await collectGesture('M', 16.7, async (index) => ({ editorMs: index === 1 ? null : 1, presentedMs: 10, automationMs: 2 }));
		expect(missing).toHaveLength(4);
		expect(missing[1]!.editorMs).toBeNull();
	});
	it('requires the expected wall identity; a mark alone or a missed/wrong wall is not success', () => {
		expect(pickIdentity(record('stage:pick', 1), 'wall')).toBeNull();
		expect(pickIdentity(undefined, 'wall')).toBeNull();
		expect(pickIdentity(record('stage:pick', 1, { outcome: 'none' }), 'wall')).toBe(false);
		expect(pickIdentity(record('stage:pick', 1, { outcome: 'resolved', sourceKind: 'wall', sourceId: 'wrong' }), 'wall')).toBe(false);
		expect(pickIdentity(record('stage:pick', 1, { outcome: 'resolved', sourceKind: 'wall', sourceId: 'wall' }), 'wall')).toBe(true);
	});
	it('never claims a working-tree HEAD is the running build without a clean matching browser identity', () => {
		const sha = 'a'.repeat(40);
		expect(previewProvenance(sha, false, [sha]).status).toBe('verified');
		for (const versions of [[null], ['b'.repeat(40)], [sha + '-dirty'], [sha, null]]) {
			expect(previewProvenance(sha, false, versions)).toMatchObject({ status: 'unverified', revision: null });
		}
		expect(previewProvenance(sha, true, [sha]).revision).toBeNull();
	});
	it('retains every measured session when disagreement requires a third, capped at three', async () => {
		const labels = ['not-smooth', 'smooth', 'not-usable'] as const;
		const sessions = await collectSessions(async (index) => ({ label: labels[index]!, onTheLine: index === 0, commitMs: [48, 10, 250][index] }));
		expect(sessions.map((session) => session.label)).toEqual(labels);
		expect(sessions.map((session) => session.commitMs)).toEqual([48, 10, 250]);
		expect(sessions.map((session) => session.sessionRequest.reason)).toEqual(['on-the-line', 'labels-disagree', 'capped']);
	});
	it('does not add a session for a clear result or missing instrumentation', async () => {
		for (const label of ['smooth', 'not-usable', 'incomplete'] as const) {
			expect(await collectSessions(async () => ({ label, onTheLine: label === 'incomplete' }))).toHaveLength(1);
		}
	});
	it('summarizes conflicting sessions conservatively without changing their labels', () => {
		const labels = ['not-usable', 'smooth', 'smooth'] as const;
		expect(sessionLabel(labels)).toBe('not-usable');
		expect(labels).toEqual(['not-usable', 'smooth', 'smooth']);
	});
});
