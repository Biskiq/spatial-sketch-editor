import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiSaveTransport } from '$lib/authoring/save/api-transport';
import { createHeadSave } from '$lib/authoring/save/head-save';
import type { SaveState } from '$lib/authoring/save/save-state';
import type { ProjectApi } from '$lib/platform/project-persistence';
import type { PerfRecord } from '$lib/platform/perf-marks';
import type { SaveAcknowledgement, SaveRequest } from '@portfolio/project-model/save';

type PerfGlobal = typeof globalThis & {
	__BISKIQ_PERF__?: { enabled?: unknown };
	__BISKIQ_PERF_RECORDS__?: PerfRecord[];
};

type PendingResponse = {
	readonly resolve: (value: SaveAcknowledgement) => void;
	readonly reject: (reason: Error) => void;
};

const perfGlobal = globalThis as PerfGlobal;
const projectId = 'project:save-receipt-timing';
let clock = 0;
let currentOperationId = '';
const pending = new Map<string, PendingResponse>();

const acknowledgement: SaveAcknowledgement = {
	projectId,
	name: 'Timing fixture',
	version: 1,
	updatedAt: '2026-10-23T00:00:00.000Z',
	savedBaseToken: 'saved-base:timing-fixture',
	savedRevision: { projectId, revisionId: 'revision:timing-fixture' },
	sourceContentId: 'content:timing-fixture'
};

const api = {
	saveAcceptedSource(request: SaveRequest): Promise<SaveAcknowledgement> {
		return new Promise((resolve, reject) => {
			pending.set(request.capture.operationId, { resolve, reject });
		});
	}
} as unknown as ProjectApi;

const transport = createApiSaveTransport(api);
const state = {
	async save() {
		const result = await transport(
			{
				contentIdentityScheme: 'test',
				capture: { projectId, operationId: currentOperationId }
			} as unknown as SaveRequest
		);
		return result.kind === 'saved'
			? { kind: 'saved' as const, acknowledgement: result.acknowledgement }
			: { kind: 'error' as const, message: 'The test transport did not save' };
	}
} as unknown as SaveState;

const head = createHeadSave(state);

function records(): PerfRecord[] {
	return perfGlobal.__BISKIQ_PERF_RECORDS__ ?? [];
}

async function runSave(submitAt: number, receiptAt: number, operationId: string): Promise<number> {
	const recordStart = records().length;
	currentOperationId = operationId;
	clock = submitAt;
	const completion = head.save();
	const runRecords = records().slice(recordStart);
	const submit = runRecords.find((record) => record.name === 'save:submit');
	if (submit === undefined) throw new Error('Head did not record the Save submit mark');

	const response = pending.get(operationId);
	if (response === undefined) throw new Error('The fake API did not receive the Save');
	clock = receiptAt;
	response.resolve(acknowledgement);
	const outcome = await completion;
	if (outcome.kind !== 'saved') throw new Error('The fake Save did not complete successfully');

	const receipt = records().slice(recordStart).find(
		(record) =>
			record.name === 'save:receipt' &&
			record.detail?.projectId === projectId &&
			record.detail?.operationId === operationId
	);
	if (receipt === undefined) throw new Error('The API transport did not mark the matching successful receipt');
	return receipt.time - submit.time;
}

beforeEach(() => {
	clock = 0;
	currentOperationId = '';
	pending.clear();
	perfGlobal.__BISKIQ_PERF__ = { enabled: true };
	perfGlobal.__BISKIQ_PERF_RECORDS__ = [];
	vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
	vi.restoreAllMocks();
	delete perfGlobal.__BISKIQ_PERF__;
	delete perfGlobal.__BISKIQ_PERF_RECORDS__;
	pending.clear();
});

describe('Save receipt timing marks', () => {
	it('excludes pre-Save time and includes delayed successful receipt time', async () => {
		const baseline = await runSave(0, 120, 'operation:baseline');
		// The gap before submit stands for project-open/edit setup plus an artificial
		// pre-Save wait. Only the interval after the product's submit mark counts.
		const afterPreSaveDelay = await runSave(8_000, 8_120, 'operation:pre-delay');
		// Advancing the receipt by 300 ms models a delayed API acknowledgement.
		const afterReceiptDelay = await runSave(20_000, 20_420, 'operation:delayed-receipt');

		expect(baseline).toBe(120);
		expect(afterPreSaveDelay).toBe(baseline);
		expect(afterReceiptDelay - baseline).toBe(300);
	});

	it('does not emit a receipt mark when the API request fails', async () => {
		currentOperationId = 'operation:failed';
		clock = 1_000;
		const recordStart = records().length;
		const completion = head.save();
		const response = pending.get(currentOperationId);
		if (response === undefined) throw new Error('The fake API did not receive the Save');
		response.reject(new Error('network failure'));

		expect(await completion).toMatchObject({ kind: 'error' });
		expect(records().slice(recordStart).some((record) => record.name === 'save:receipt')).toBe(false);
	});

	it('does not record a receipt when the harness is disabled', async () => {
		delete perfGlobal.__BISKIQ_PERF__;
		currentOperationId = 'operation:ordinary-build';
		clock = 1_000;
		const completion = head.save();
		const response = pending.get(currentOperationId);
		if (response === undefined) throw new Error('The fake API did not receive the Save');
		response.resolve(acknowledgement);

		expect(await completion).toEqual({ kind: 'saved' });
		expect(records()).toEqual([]);
	});
});
