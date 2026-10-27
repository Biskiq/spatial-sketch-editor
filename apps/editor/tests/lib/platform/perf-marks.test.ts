import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	PERF_RECORD_LIMIT,
	perfInput,
	perfInstall,
	perfMark,
	perfMeasureAsync,
	perfMeasureSync,
	perfMarksEnabled,
	perfResult,
	perfSequence,
	perfTracePreview,
	type PerfRecord
} from '$lib/platform/perf-marks';

type PerfGlobal = typeof globalThis & {
	__BISKIQ_PERF__?: { enabled?: unknown };
	__BISKIQ_PERF_RECORDS__?: PerfRecord[];
};

const perfGlobal = globalThis as PerfGlobal;

function records(): PerfRecord[] {
	return perfGlobal.__BISKIQ_PERF_RECORDS__ ?? [];
}

function enable(): void {
	perfGlobal.__BISKIQ_PERF__ = { enabled: true };
}

beforeEach(() => {
	delete perfGlobal.__BISKIQ_PERF__;
	delete perfGlobal.__BISKIQ_PERF_RECORDS__;
});

afterEach(() => {
	delete perfGlobal.__BISKIQ_PERF__;
	delete perfGlobal.__BISKIQ_PERF_RECORDS__;
});

describe('perf marks are inert unless the harness enables them', () => {
	it('reports disabled and records nothing by default', () => {
		expect(perfMarksEnabled()).toBe(false);
		perfInput('pointermove');
		perfInstall('wall-preview');
		perfResult('accepted-result');
		perfMark('save:command');
		expect(perfSequence()).toBe(0);
		expect(perfGlobal.__BISKIQ_PERF_RECORDS__).toBeUndefined();
	});

	it('treats a non-boolean flag as disabled', () => {
		perfGlobal.__BISKIQ_PERF__ = { enabled: 'yes' };
		expect(perfMarksEnabled()).toBe(false);
		perfMark('save:command');
		expect(perfGlobal.__BISKIQ_PERF_RECORDS__).toBeUndefined();
	});

	it('does not evaluate installation detail or touch user timing while disabled', () => {
		// `perfInstall` is on the continuous-drag path. Building its
		// sequence-carrying detail object before the flag check would allocate on
		// every pointer sample and would run getters the caller did not expect the
		// ordinary build to run. A throwing getter proves the helper never reaches
		// that work, and the clock/mark spies prove it emits nothing.
		const now = vi.spyOn(performance, 'now');
		const mark = vi.spyOn(performance, 'mark');
		const detail = Object.defineProperty({}, 'wallId', {
			enumerable: true,
			get() {
				throw new Error('installation detail was evaluated while disabled');
			}
		});
		try {
			expect(() => perfInstall('wall-preview', detail)).not.toThrow();
			expect(now).not.toHaveBeenCalled();
			expect(mark).not.toHaveBeenCalled();
		} finally {
			now.mockRestore();
			mark.mockRestore();
		}
	});
});

describe('enabled correlation records', () => {
	it('records direct synchronous Save work with a phase and elapsed duration', () => {
		enable();
		expect(perfMeasureSync('save.request-json', () => 42)).toBe(42);
		expect(records().at(-1)).toMatchObject({
			kind: 'mark',
			name: 'save:work',
			detail: { phase: 'save.request-json' }
		});
		expect(records().at(-1)?.detail?.elapsedMs).toEqual(expect.any(Number));
	});

	it('records asynchronous hash wall time separately from synchronous Save work', async () => {
		enable();
		await expect(perfMeasureAsync('save.hash-wall', async () => 'digest')).resolves.toBe('digest');
		expect(records().at(-1)).toMatchObject({
			kind: 'mark',
			name: 'save:async-wall',
			detail: { phase: 'save.hash-wall' }
		});
	});

	it('carries the monotonic input sequence into installation and result records', () => {
		enable();
		expect(perfInput('pointermove', { wallMode: true })).toBe(1);
		perfInstall('wall-preview', { wallId: 'wall-1' });
		expect(perfInput('pointermove')).toBe(2);
		perfInstall('wall-preview');
		perfResult('accepted-result', { sourceContentId: 'content-2' });

		expect(records().map((entry) => [entry.kind, entry.name, entry.sequence])).toEqual([
			['input', 'pointermove', 1],
			['install', 'wall-preview', 1],
			['input', 'pointermove', 2],
			['install', 'wall-preview', 2],
			['result', 'accepted-result', 2]
		]);
		expect(records()[1]?.detail).toMatchObject({ wallId: 'wall-1' });
		expect(records()[0]?.time).toBeLessThanOrEqual(records()[4]?.time ?? 0);
	});

	it('emits a user-timing mark per record so a trace carries the same names', () => {
		enable();
		perfMark('stage:activated');
		const names = performance.getEntriesByType('mark').map((entry) => entry.name);
		expect(names).toContain('biskiq:mark:stage:activated');
	});

	it('bounds the ledger so a long repeat-use run cannot grow without limit', () => {
		enable();
		for (let index = 0; index < PERF_RECORD_LIMIT + 10; index++) perfMark('tick');
		expect(records()).toHaveLength(PERF_RECORD_LIMIT);
	});
});


describe('diagnostic overlay identity', () => {
	it('does not inspect marker geometry without the separate diagnostic flag', () => {
		const markers = new Proxy([], { get() { throw new Error('geometry inspected'); } });
		expect(perfTracePreview(markers)).toBeNull();
		enable();
		expect(perfTracePreview(markers)).toBeNull();
	});

	it('names the installed preview and exact geometry rather than the newest unrelated input', () => {
		Object.assign(perfGlobal, { __BISKIQ_PERF__: { enabled: true, traceProof: true } });
		const sequence = perfInput('pointermove');
		perfInstall('wall-preview');
		perfInput('unrelated');
		const markers = [{ id: 'layout-wall-preview', css: [20, 30] as const, label: 'preview' }];
		const token = perfTracePreview(markers);
		expect(token?.sequence).toBe(sequence);
		expect(token?.css).toEqual([20, 30]);
		expect(token?.bits).toHaveLength(64);
		const detail = records().at(-1)?.detail;
		expect(structuredClone(detail)).toEqual(detail);
		expect(performance.getEntriesByName(`biskiq:mark:trace:overlay:${sequence}:${token?.signature}`).length).toBeGreaterThan(0);
		expect(perfTracePreview([{ ...markers[0]!, css: [21, 30] }])?.signature).not.toBe(token?.signature);
		expect(perfTracePreview([])).toBeNull();
	});
});
