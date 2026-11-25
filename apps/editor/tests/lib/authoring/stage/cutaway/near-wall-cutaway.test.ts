/**
 * X2 §10.1 — the session store: memory, masks and the sticky release.
 *
 * The store is the only stateful half of X2. These tests pin D3 (default Cut),
 * D8 (a still Camera re-classifies nothing), D9 (a deselected Wall stays whole
 * until the next pose change), D2's hold mask and D11's Plan clearing.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CompiledPhysicalWall, CompiledRoom, LayoutVec2 } from '@portfolio/layout-core/geometry';
import { nearWallCutaway } from '$lib/authoring/stage/cutaway/near-wall-cutaway.svelte';
import type { NearWallEvaluation } from '$lib/authoring/stage/cutaway/near-wall-cutaway.svelte';

const FLOOR = 'floor-1';

function room(): CompiledRoom {
	return {
		roomId: 'room',
		floorPolygon: [[0, 0], [6, 0], [6, 4], [0, 4]] as LayoutVec2[],
		floorElevation: 0,
		ceilingElevation: 3
	} as unknown as CompiledRoom;
}

function southWall(): CompiledPhysicalWall {
	return {
		wallId: 'south',
		floorId: FLOOR,
		height: 3,
		thickness: 0.2,
		solidCenterlinePolylines: [[[0, 0], [6, 0]] as LayoutVec2[]],
		samples: [],
		solidSpans: [],
		bounds3: null
	} as unknown as CompiledPhysicalWall;
}

const EMPTY: ReadonlySet<string> = new Set();

function evaluation(overrides: Partial<NearWallEvaluation> = {}): NearWallEvaluation {
	return {
		eye: [3, 1.6, -5],
		target: [3, 1.2, 2],
		rooms: [room()],
		walls: [southWall()],
		floors: [{ floorId: FLOOR, elevation: 0 }],
		renderedReading: '3d',
		geometryRevision: 'r1',
		pressing: false,
		...overrides
	};
}

beforeEach(() => {
	nearWallCutaway.reset();
	nearWallCutaway.setSelectionHosts(EMPTY);
});

describe('default and decision memory', () => {
	it('starts at Cut with no decision', () => {
		expect(nearWallCutaway.mode).toBe('cut');
		expect(nearWallCutaway.held).toBe(false);
		expect(nearWallCutaway.decision).toBe(null);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual([]);
	});

	it('classifies once and is a no-op at the same pose and revision', () => {
		expect(nearWallCutaway.evaluate(evaluation())).toBe(true);
		const decision = nearWallCutaway.decision;
		expect([...nearWallCutaway.classified]).toEqual(['south']);
		expect(nearWallCutaway.stubTopY).toBe(1);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual(['south']);

		expect(nearWallCutaway.evaluate(evaluation())).toBe(false);
		expect(nearWallCutaway.decision).toBe(decision);
	});

	it('re-classifies when the pose moves', () => {
		nearWallCutaway.evaluate(evaluation());
		expect(nearWallCutaway.evaluate(evaluation({ eye: [3, 1.6, -4.5] }))).toBe(true);
		expect(nearWallCutaway.classified.has('south')).toBe(true);
	});
});

describe('selection exemption and sticky release', () => {
	it('exempts a host Wall, then keeps a deselected Wall whole until the pose moves', () => {
		nearWallCutaway.evaluate(evaluation());
		const host = new Set(['south']);
		nearWallCutaway.setSelectionHosts(host);
		expect([...nearWallCutaway.effective(host)]).toEqual([]);

		nearWallCutaway.setSelectionHosts(EMPTY);
		expect(nearWallCutaway.sticky.has('south')).toBe(true);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual([]);

		// At rest the sticky release is not reconsidered.
		expect(nearWallCutaway.evaluate(evaluation())).toBe(false);
		expect(nearWallCutaway.sticky.has('south')).toBe(true);

		// The next meaningful pose change re-enters ordinary classification.
		expect(nearWallCutaway.evaluate(evaluation({ eye: [3, 1.6, -4.5] }))).toBe(true);
		expect(nearWallCutaway.sticky.size).toBe(0);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual(['south']);
	});

	it('does not make a Wall sticky when it was not cut', () => {
		nearWallCutaway.evaluate(evaluation({ eye: [3, 1.6, 1], target: [3, 1.2, 2] }));
		expect(nearWallCutaway.classified.size).toBe(0);
		nearWallCutaway.setSelectionHosts(new Set(['south']));
		nearWallCutaway.setSelectionHosts(EMPTY);
		expect(nearWallCutaway.sticky.size).toBe(0);
	});
});

describe('presentation masks', () => {
	it('Whole and the W hold both empty the effective set without erasing the decision', () => {
		nearWallCutaway.evaluate(evaluation());
		nearWallCutaway.setMode('whole');
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual([]);
		expect(nearWallCutaway.classified.has('south')).toBe(true);

		nearWallCutaway.setMode('cut');
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual(['south']);
		nearWallCutaway.setHeld(true);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual([]);
		nearWallCutaway.setHeld(false);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual(['south']);
	});

	it('Plan clears the decision and the hold key', () => {
		nearWallCutaway.setHeld(true);
		nearWallCutaway.evaluate(evaluation());
		expect(nearWallCutaway.evaluate(evaluation({ renderedReading: 'plan' }))).toBe(true);
		expect(nearWallCutaway.decision).toBe(null);
		expect(nearWallCutaway.held).toBe(false);
		expect([...nearWallCutaway.effective(EMPTY)]).toEqual([]);
	});

	it('reset returns to Cut and forgets everything', () => {
		nearWallCutaway.evaluate(evaluation());
		nearWallCutaway.setMode('whole');
		nearWallCutaway.setHeld(true);
		nearWallCutaway.setSelectionHosts(new Set(['south']));
		nearWallCutaway.reset();
		expect(nearWallCutaway.mode).toBe('cut');
		expect(nearWallCutaway.held).toBe(false);
		expect(nearWallCutaway.decision).toBe(null);
		expect(nearWallCutaway.sticky.size).toBe(0);
	});
});

describe('press freezing', () => {
	it('freezes a geometry revision during a press and applies it after release', () => {
		nearWallCutaway.evaluate(evaluation());
		expect(nearWallCutaway.evaluate(evaluation({ geometryRevision: 'r2', pressing: true }))).toBe(false);
		expect(nearWallCutaway.decision?.geometryRevision).toBe('r1');

		expect(nearWallCutaway.evaluate(evaluation({ geometryRevision: 'r2' }))).toBe(true);
		expect(nearWallCutaway.decision?.geometryRevision).toBe('r2');
	});
});
