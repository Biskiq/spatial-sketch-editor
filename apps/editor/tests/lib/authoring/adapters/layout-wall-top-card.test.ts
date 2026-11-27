/**
 * T1 V2c — the Card's Level/Slope/Gable writer and the height-family knobs.
 *
 * The controller is the same framework-free instrument the Card renders, so
 * these cases pin what a creator actually gets: one canonical `layout-wall-top`
 * intent per shape change, exact Rise and Apex edits, Centre apex as a no-op at
 * the centre, and the Opening-named refusal V2b's formatter owns.
 *
 * The knob anchors are read through the canonical development map in both
 * readings: the folded Wall face at development amount 0, and the live Unroll
 * sheet at the same station. A level top keeps no shape knobs.
 */
import { describe, expect, it } from 'vitest';

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core/geometry';
import {
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planExactWallHeight,
	planSetWallTop,
	type LayoutDocumentWallFirst,
	type LayoutWall,
	type LayoutWallTop
} from '@portfolio/layout-core/wall';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';

import {
	createLayoutInstrument,
	type LayoutWritePort
} from '$lib/authoring/adapters/layout/instrument';
import { LAYOUT_WALL_HEIGHT_KIND, LAYOUT_WALL_TOP_KIND } from '$lib/authoring/adapters/layout/precision';
import { wallEditRejectionWords } from '$lib/authoring/adapters/layout/refusals';
import {
	WALL_TOP_DEFAULT_PITCH_RADIANS,
	wallTopForKnobDrag,
	wallTopForShape,
	wallTopWithApexPosition,
	wallTopWithCentredApex,
	wallTopWithRise
} from '$lib/authoring/adapters/layout/wall-top-edits';
import {
	wallHeightKnobSpot,
	wallTopBreakpointSpots
} from '$lib/authoring/adapters/layout/wall-top-frame';
import { createWallUnfoldState } from '$lib/layout/wall-unfold';
import {
	buildWallUnfoldDisplay,
	unfoldDisplayPointAtStation
} from '$lib/layout/wall-unfold-pick';

const LENGTH = 8;
const HEIGHT = 3;

function wall(overrides: Partial<LayoutWall> = {}): LayoutWall {
	return {
		id: 'w1',
		startJunctionId: 'j1',
		endJunctionId: 'j2',
		thickness: 0.2,
		height: HEIGHT,
		top: { kind: 'level' },
		centerline: { kind: 'line' },
		...overrides
	};
}

function documentWith(entry: LayoutWall = wall()): LayoutDocumentWallFirst {
	const base = createEmptyWallFirstLayoutDocument();
	base.junctions = [
		{ id: 'j1', point: [0, 0] },
		{ id: 'j2', point: [LENGTH, 0] }
	];
	base.walls = [entry];
	return base;
}

function compiledOf(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometry(document);
	expect(result.issues ?? []).toEqual([]);
	return result.geometry.walls[0]!;
}

function fakePort(): LayoutWritePort & { readonly intents: AuthoringIntent[] } {
	const intents: AuthoringIntent[] = [];
	return {
		intents,
		accept: async (intent) => {
			intents.push(intent);
			return { kind: 'installed' };
		},
		acceptedRevision: () => ({ revisionId: 'revision-1' })
	};
}

function instrumentOn(document: LayoutDocumentWallFirst, port: LayoutWritePort) {
	return createLayoutInstrument({
		subject: { kind: 'wall', id: 'w1' },
		document,
		projectId: 'project-v2c',
		contentRevision: 'content-1',
		port
	});
}

function topPayload(intent: AuthoringIntent): LayoutWallTop {
	const payload = intent.payload as { readonly top: LayoutWallTop };
	return payload.top;
}

describe('V2c · shape defaults', () => {
	it('raises a level Wall to a 30° slope over its length', () => {
		const top = wallTopForShape('slope', LENGTH, { kind: 'level' });
		expect(top.kind).toBe('slope');
		if (top.kind !== 'slope') return;
		expect(top.startRise).toBe(0);
		expect(top.endRise).toBeCloseTo(Math.tan(WALL_TOP_DEFAULT_PITCH_RADIANS) * LENGTH, 12);
	});

	it('centres a gable at half length and keeps a slope’s authored ends', () => {
		const fromLevel = wallTopForShape('gable', LENGTH, { kind: 'level' });
		expect(fromLevel).toMatchObject({ kind: 'gable', startRise: 0, endRise: 0, apexOffset: 4 });
		const fromSlope = wallTopForShape('gable', LENGTH, {
			kind: 'slope',
			startRise: 1,
			endRise: 2
		});
		expect(fromSlope).toMatchObject({
			kind: 'gable',
			startRise: 1,
			endRise: 2,
			apexOffset: 4
		});
		if (fromSlope.kind !== 'gable') return;
		expect(fromSlope.apexRise).toBeGreaterThan(2);
	});

	it('returns to slope and level without inventing negatives', () => {
		const gable: LayoutWallTop = {
			kind: 'gable',
			startRise: 1,
			endRise: 0,
			apexRise: 3,
			apexOffset: 2
		};
		expect(wallTopForShape('slope', LENGTH, gable)).toEqual({
			kind: 'slope',
			startRise: 1,
			endRise: 0
		});
		expect(wallTopForShape('level', LENGTH, gable)).toEqual({ kind: 'level' });
	});
});

describe('V2c · exact Rise, Apex and knob drags', () => {
	it('edits the slope high end and the gable apex without touching the other fields', () => {
		expect(wallTopWithRise({ kind: 'slope', startRise: 0, endRise: 2 }, 3)).toEqual({
			kind: 'slope',
			startRise: 0,
			endRise: 3
		});
		const gable: LayoutWallTop = {
			kind: 'gable',
			startRise: 0,
			endRise: 1,
			apexRise: 3,
			apexOffset: 2
		};
		expect(wallTopWithRise(gable, 4)).toEqual({ ...gable, apexRise: 4 });
		expect(wallTopWithApexPosition(gable, 5)).toEqual({ ...gable, apexOffset: 5 });
		expect(wallTopWithCentredApex(gable, LENGTH)).toEqual({ ...gable, apexOffset: 4 });
		expect(wallTopWithRise({ kind: 'level' }, 2)).toBeNull();
		expect(wallTopWithApexPosition({ kind: 'level' }, 2)).toBeNull();
	});

	it('normalizes an absolute breakpoint drag into the canonical height and top', () => {
		const dragged = wallTopForKnobDrag({
			current: { kind: 'slope', startRise: 0, endRise: 2 },
			height: HEIGHT,
			knob: 'start',
			topLocal: 4,
			length: LENGTH
		});
		expect(dragged.height).toBe(4);
		expect(dragged.top).toEqual({ kind: 'slope', startRise: 0, endRise: 1 });

		const raised = wallTopForKnobDrag({
			current: { kind: 'slope', startRise: 0, endRise: 2 },
			height: HEIGHT,
			knob: 'end',
			topLocal: 5,
			length: LENGTH
		});
		expect(raised.height).toBe(HEIGHT);
		expect(raised.top).toEqual({ kind: 'slope', startRise: 0, endRise: 2 });
	});

	it('collapses a gable apex onto its ends, and equal ends onto level', () => {
		const gable: LayoutWallTop = {
			kind: 'gable',
			startRise: 0,
			endRise: 0,
			apexRise: 2,
			apexOffset: 4
		};
		const collapsed = wallTopForKnobDrag({
			current: gable,
			height: HEIGHT,
			knob: 'apex',
			topLocal: HEIGHT,
			length: LENGTH
		});
		expect(collapsed).toEqual({ height: HEIGHT, top: { kind: 'level' } });
		const peak = wallTopForKnobDrag({
			current: gable,
			height: HEIGHT,
			knob: 'apex',
			topLocal: HEIGHT + 1,
			length: LENGTH
		});
		expect(peak).toEqual({
			height: HEIGHT,
			top: { kind: 'gable', startRise: 0, endRise: 0, apexRise: 1, apexOffset: 4 }
		});
	});
});

describe('V2c · the Card submits one canonical top intent', () => {
	it('installs Slope, then Gable, with no write for the shape already held', async () => {
		const port = fakePort();
		const instrument = instrumentOn(documentWith(), port);

		expect(await instrument.setTopKind('slope')).toEqual({ kind: 'accepted' });
		expect(port.intents).toHaveLength(1);
		expect(port.intents[0]!.kind).toBe(LAYOUT_WALL_TOP_KIND);
		expect(topPayload(port.intents[0]!)).toMatchObject({ kind: 'slope', startRise: 0 });

		expect(await instrument.setTopKind('slope')).toEqual({ kind: 'accepted' });
		expect(port.intents).toHaveLength(1);
		expect(instrument.proposalLive()).toBe(false);

		expect(await instrument.setTopKind('gable')).toEqual({ kind: 'accepted' });
		expect(port.intents).toHaveLength(2);
		const gable = topPayload(port.intents[1]!);
		expect(gable).toMatchObject({ kind: 'gable', startRise: 0, apexOffset: LENGTH / 2 });
		if (gable.kind !== 'gable') return;
		// Switching from the accepted slope keeps its authored ends.
		expect(gable.endRise).toBeGreaterThan(0);
		expect(gable.apexRise).toBeGreaterThan(gable.endRise);
	});

	it('commits exact Rise and Apex fields as the same one-intent writer', async () => {
		const gable: LayoutWallTop = {
			kind: 'gable',
			startRise: 0,
			endRise: 0,
			apexRise: 2,
			apexOffset: 4
		};
		const port = fakePort();
		const instrument = instrumentOn(documentWith(wall({ top: gable })), port);

		instrument.edit('rise', '3.25');
		expect(await instrument.commit('rise')).toEqual({ kind: 'accepted' });
		expect(topPayload(port.intents[0]!)).toMatchObject({ kind: 'gable', apexRise: 3.25 });

		instrument.edit('apex', '2.75');
		expect(await instrument.commit('apex')).toEqual({ kind: 'accepted' });
		expect(topPayload(port.intents[1]!)).toMatchObject({ apexOffset: 2.75 });

		expect(await instrument.centreApex()).toEqual({ kind: 'accepted' });
		expect(topPayload(port.intents[2]!)).toMatchObject({ apexOffset: LENGTH / 2 });
		expect(await instrument.centreApex()).toEqual({ kind: 'accepted' });
		expect(port.intents).toHaveLength(3);
	});

	it('keeps Height available while a profile is authored, as a rigid shift', async () => {
		const slope: LayoutWallTop = { kind: 'slope', startRise: 0, endRise: 2 };
		const port = fakePort();
		const instrument = instrumentOn(documentWith(wall({ top: slope })), port);
		instrument.edit('height', '4.5');
		expect(await instrument.commit('height')).toEqual({ kind: 'accepted' });
		expect(port.intents[0]).toMatchObject({
			kind: LAYOUT_WALL_HEIGHT_KIND,
			payload: { wallId: 'w1', height: 4.5 }
		});
	});

	it('offers no Rise or Apex field on a level top and takes no write', async () => {
		const port = fakePort();
		const instrument = instrumentOn(documentWith(), port);
		expect(instrument.fields().some((field) => field.id === 'rise')).toBe(false);
		expect(instrument.edit('rise', '2')).toBeNull();
		expect(await instrument.commit('rise')).toEqual({ kind: 'unknown-field' });
		expect(port.intents).toEqual([]);
	});
});

describe('V2c · the top refusal names the Opening it cuts into', () => {
	it('resolves the V2b target id to the Opening name', () => {
		const base = documentWith(wall({ top: { kind: 'slope', startRise: 0, endRise: 2 } }));
		const opening = planCreateWallFirstOpening(
			base,
			{
				wallId: 'w1',
				kind: 'window',
				offset: 7,
				width: 0.5,
				height: 0.5,
				sillHeight: 3
			},
			freshCapture(),
			base.floor.id
		);
		if (opening.kind === 'rejected') throw new Error(opening.rejection.message);
		const document: LayoutDocumentWallFirst = {
			...opening.document,
			openings: opening.document.openings.map((entry) => ({ ...entry, name: 'High window' }))
		};
		// Reversing the slope lowers the top over the opening at 7 m from 3.75 m
		// to 3.25 m, below its 3.5 m head.
		const plan = planSetWallTop(document, 'w1', { kind: 'slope', startRise: 2, endRise: 0 });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(wallEditRejectionWords(document, plan.rejection)).toBe(
			'This top would cut into "High window". Raise the top there or lower the Opening.'
		);
	});

	it('names the Opening when a Height edit cuts into it', () => {
		const base = documentWith(wall());
		const opening = planCreateWallFirstOpening(
			base,
			{
				wallId: 'w1',
				kind: 'window',
				offset: 7,
				width: 0.5,
				height: 0.5,
				sillHeight: 2
			},
			freshCapture(),
			base.floor.id
		);
		if (opening.kind === 'rejected') throw new Error(opening.rejection.message);
		const document: LayoutDocumentWallFirst = {
			...opening.document,
			openings: opening.document.openings.map((entry) => ({ ...entry, name: 'High window' }))
		};
		// A 2.4 m Wall no longer clears the 2.5 m head of the window at 7 m.
		const plan = planExactWallHeight(document, 'w1', 2.4);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(wallEditRejectionWords(document, plan.rejection)).toBe(
			'This top would cut into "High window". Raise the top there or lower the Opening.'
		);
	});
});

describe('V2c · hexagonal knobs follow the canonical development map', () => {
	it('places start and end knobs on the folded Wall face at their authored tops', () => {
		const wallEntry = wall({ top: { kind: 'slope', startRise: 0, endRise: 2 } });
		const document = documentWith(wallEntry);
		const compiled = compiledOf(document);
		const spots = wallTopBreakpointSpots({
			wall: compiled,
			layout: document,
			datumMeters: 0,
			eye: [4, 10, 30],
			unfold: null,
			top: wallEntry.top,
			height: wallEntry.height
		});
		expect(spots.map((spot) => spot.knob)).toEqual(['start', 'end']);
		expect(spots[0]).toMatchObject({ station: 0, topLocal: HEIGHT });
		expect(spots[1]).toMatchObject({ station: LENGTH, topLocal: HEIGHT + 2 });
		for (const spot of spots) {
			expect(spot.anchor[1]).toBeCloseTo(spot.topLocal, 9);
			// On the visible face, half the thickness plus the clearance off the centerline.
			expect(Math.abs(spot.anchor[2])).toBeCloseTo(0.12, 9);
			expect(spot.anchor[0]).toBeCloseTo(spot.station, 9);
		}
	});

	it('puts the apex knob on the live Unroll sheet at the canonical station', () => {
		const top: LayoutWallTop = {
			kind: 'gable',
			startRise: 0,
			endRise: 0,
			apexRise: 2,
			apexOffset: 3
		};
		const document = documentWith(wall({ top }));
		const compiled = compiledOf(document);
		const state = createWallUnfoldState({
			wall: compiled,
			anchorStation: 1,
			entry: {
				pose: {
					target: [4, 5, 0],
					azimuthRadians: 0.35,
					elevationRadians: 0.4,
					targetPlaneHeightMeters: 12
				},
				reading: '3d'
			},
			u: 1
		});
		const display = buildWallUnfoldDisplay(compiled, state, {
			floorY: 0,
			spans: [],
			sideAngle: 0
		});
		expect(display).not.toBeNull();
		const mapped = unfoldDisplayPointAtStation(display!, 3, 0);
		const spots = wallTopBreakpointSpots({
			wall: compiled,
			layout: document,
			datumMeters: 0,
			eye: [4, 10, 30],
			unfold: { state, sideAngle: 0 },
			top,
			height: HEIGHT
		});
		expect(spots.map((spot) => spot.knob)).toEqual(['start', 'apex', 'end']);
		const apex = spots[1]!;
		expect(apex).toMatchObject({ station: 3, topLocal: HEIGHT + 2 });
		expect(apex.anchor[1]).toBeCloseTo(HEIGHT + 2, 9);
		expect(Math.hypot(apex.anchor[0] - mapped.point[0], apex.anchor[2] - mapped.point[1])).toBeCloseTo(0.03, 9);
	});

	it('keeps no shape knobs on a level top and puts Height at the eave end', () => {
		const level = wall();
		const document = documentWith(level);
		const compiled = compiledOf(document);
		const context = {
			wall: compiled,
			layout: document,
			datumMeters: 0,
			eye: [0, 10, 30] as const,
			unfold: null
		};
		expect(wallTopBreakpointSpots({ ...context, top: level.top, height: level.height })).toEqual([]);
		const height = wallHeightKnobSpot({ ...context, top: level.top, height: level.height });
		expect(height).toMatchObject({ knob: 'height', station: 0, topLocal: HEIGHT });
		const falling: LayoutWallTop = { kind: 'slope', startRise: 2, endRise: 0 };
		const low = wallHeightKnobSpot({ ...context, top: falling, height: HEIGHT });
		expect(low).toMatchObject({ station: LENGTH, topLocal: HEIGHT });
	});
});

