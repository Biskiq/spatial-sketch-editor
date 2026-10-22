import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	PERF_RECORD_LIMIT,
	perfInput,
	perfInstall,
	perfMark,
	perfMarksEnabled,
	perfResult,
	perfSequence,
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
		perfMark('save:submit');
		expect(perfSequence()).toBe(0);
		expect(perfGlobal.__BISKIQ_PERF_RECORDS__).toBeUndefined();
	});

	it('treats a non-boolean flag as disabled', () => {
		perfGlobal.__BISKIQ_PERF__ = { enabled: 'yes' };
		expect(perfMarksEnabled()).toBe(false);
		perfMark('save:submit');
		expect(perfGlobal.__BISKIQ_PERF_RECORDS__).toBeUndefined();
	});
});

describe('enabled correlation records', () => {
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
