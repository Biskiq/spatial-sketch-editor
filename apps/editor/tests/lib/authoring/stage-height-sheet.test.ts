/**
 * R217.S06 — the Height Sheet's one height fact.
 *
 * The Sheet is session view state: it resets on a project replacement, it never
 * writes source, history or Save, and a later Slice registers another consumer
 * role without editing the module. These tests pin the authority, the merge and
 * the replacement reset; the mounted control and Plan-cut integration are
 * proven by the route and facade suites in C2/C3.
 */
import { describe, expect, it } from 'vitest';
import {
	HEIGHT_TICK_MERGE_TOLERANCE_METERS,
	createStageHeightSheet,
	mergeStageHeightTicks,
	type StageHeightTick
} from '$lib/authoring/stage/stage-height-sheet';
import { PLAN_DEFAULT_CUT_HEIGHT_METERS } from '$lib/authoring/stage/plan-parameters';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';

describe('R217.S06 — the one Height Sheet height fact', () => {
	it('starts at the calibrated Plan cut with no pins', () => {
		const sheet = createStageHeightSheet();
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		expect(sheet.pins()).toEqual([]);
		expect(sheet.maxHeightMeters()).toBe(Number.POSITIVE_INFINITY);
	});

	it('accepts a finite height, ignores a non-finite one and clamps to the range', () => {
		const sheet = createStageHeightSheet({ maxHeightMeters: 4 });
		sheet.set(2.4, 'drag');
		expect(sheet.height()).toBe(2.4);
		sheet.set(Number.NaN, 'key');
		expect(sheet.height()).toBe(2.4);
		sheet.set(Number.POSITIVE_INFINITY, 'key');
		expect(sheet.height()).toBe(2.4);
		sheet.set(-1, 'key');
		expect(sheet.height()).toBe(0);
		sheet.set(9, 'tick');
		expect(sheet.height()).toBe(4);
	});

	it('keeps the current height when the known-surface bound changes', () => {
		const sheet = createStageHeightSheet();
		sheet.set(3, 'drag');
		sheet.setMaxHeightMeters(1.5);
		expect(sheet.height()).toBe(3);
		expect(sheet.maxHeightMeters()).toBe(1.5);
		sheet.set(4, 'key');
		expect(sheet.height()).toBe(1.5);
	});

	it('notifies every role in registration order and only on a real change', () => {
		const sheet = createStageHeightSheet();
		const seen: string[] = [];
		sheet.subscribe('plan-cut', (height) => seen.push(`cut:${height}`));
		sheet.subscribe('probe', (height) => seen.push(`probe:${height}`));
		sheet.set(2, 'drag');
		sheet.set(2, 'drag');
		expect(seen).toEqual(['cut:2', 'probe:2']);
	});

	it('isolates a throwing subscriber and unsubscribes exactly once', () => {
		const sheet = createStageHeightSheet();
		const seen: number[] = [];
		const off = sheet.subscribe('broken', () => {
			throw new Error('consumer failed');
		});
		sheet.subscribe('probe', (height) => seen.push(height));
		sheet.set(1.8, 'key');
		expect(seen).toEqual([1.8]);
		off();
		sheet.set(2.1, 'key');
		expect(seen).toEqual([1.8, 2.1]);
	});

	it('keeps pins session-only, finite, sorted and deduped within 5 mm', () => {
		const sheet = createStageHeightSheet();
		sheet.addPin(0.75);
		sheet.addPin(0.3);
		sheet.addPin(0.752);
		sheet.addPin(Number.NaN);
		sheet.addPin(-1);
		expect(sheet.pins()).toEqual([0.3, 0.75]);
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		sheet.removePin(0.751);
		expect(sheet.pins()).toEqual([0.3]);
	});

	it('resets to the datum and clears pins while keeping subscribers', () => {
		const sheet = createStageHeightSheet();
		const seen: number[] = [];
		sheet.subscribe('probe', (height) => seen.push(height));
		sheet.set(2.6, 'drag');
		sheet.addPin(0.75);
		sheet.reset();
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		expect(sheet.pins()).toEqual([]);
		expect(seen).toEqual([2.6, PLAN_DEFAULT_CUT_HEIGHT_METERS]);
	});

	it('resets only on replace(), never on session creation or a content install', () => {
		const session = createStageSession({ sessionEpoch: 'session-height' });
		const sheet = session.heightSheet();
		sheet.set(2.4, 'drag');
		sheet.addPin(0.75);
		// The session reset is independent of snapshot contents; these transitions
		// pin lifecycle, not admission. The admitted snapshot's own epoch becomes
		// the session epoch, which is the only field replace() reads here.
		const admitted = { sessionEpoch: 'session-height-replacement' } as unknown as StageReadSnapshot;
		session.replace(admitted);
		expect(session.heightSheet()).toBe(sheet);
		expect(sheet.height()).toBe(PLAN_DEFAULT_CUT_HEIGHT_METERS);
		expect(sheet.pins()).toEqual([]);
		expect(session.sessionEpoch).toBe('session-height-replacement');
	});
});

describe('R217.S06 — owner-declared height ticks', () => {
	const tick = (kind: StageHeightTick['kind'], heightMeters: number, label: string): StageHeightTick => ({
		kind,
		heightMeters,
		label
	});

	it('sorts, keeps one datum and merges declared heights within 5 mm', () => {
		const merged = mergeStageHeightTicks([
			tick('found', 0.753, 'Table top'),
			tick('found', 0.75, 'Table'),
			tick('found', 0.004, 'Scene floor'),
			tick('datum', 0, 'Floor')
		]);
		expect(merged).toEqual([
			{ kind: 'datum', heightMeters: 0, label: 'Floor' },
			{ kind: 'found', heightMeters: 0.75, label: 'Table' }
		]);
		expect(HEIGHT_TICK_MERGE_TOLERANCE_METERS).toBe(0.005);
	});

	it('never chains a group past its anchor and is deterministic for a shuffled input', () => {
		const input = [
			tick('found', 0, 'Base'),
			tick('found', 0.004, 'Near base'),
			tick('found', 0.009, 'Anchored farther')
		];
		const shuffled = [input[2]!, input[0]!, input[1]!];
		expect(mergeStageHeightTicks(input)).toEqual(mergeStageHeightTicks(shuffled));
		expect(mergeStageHeightTicks(input)).toHaveLength(2);
	});

	it('drops non-finite, negative and unlabelled ticks and never mutates its input', () => {
		const input = [tick('datum', 0, 'Floor'), tick('found', Number.NaN, 'Broken'), tick('found', -1, 'Below'), tick('found', 1, '')];
		const copy = [...input];
		expect(mergeStageHeightTicks(input)).toEqual([{ kind: 'datum', heightMeters: 0, label: 'Floor' }]);
		expect(input).toEqual(copy);
	});

	it('keeps a datum as the group winner even when a found surface is nearer', () => {
		const merged = mergeStageHeightTicks([
			tick('found', 0.001, 'Plinth'),
			tick('datum', 0, 'Floor')
		]);
		expect(merged).toEqual([{ kind: 'datum', heightMeters: 0, label: 'Floor' }]);
	});
});
