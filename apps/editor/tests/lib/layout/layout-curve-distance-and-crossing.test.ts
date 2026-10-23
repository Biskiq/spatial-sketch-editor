/**
 * P23.11 fix 2 / fix 3 / blocker 2 — Wall-distance authority and curved-Wall
 * crossing policy.
 *
 * Three properties pinned here, each one seam apart:
 *
 * - **one authored Wall-distance metric** — compiled samples, the authored Wall
 *   span and the exact chain arc all report the same metres, and a bend point
 *   inserted at a compiled Wall-hit distance lands at that distance;
 * - **curved-crossing gate** — a new straight Wall that bows across an existing
 *   curved Wall whose endpoint chord is clear rejects through the canonical
 *   sampled authority, with no partial mutation. SINCE P23B.3a S5 the gate's
 *   subject is the CONNECTED COMPONENT the two Walls share, so an INDEPENDENT
 *   bow crossing is permitted geometry that adopts and splits nothing;
 * - **authored endpoint T onto a curved host** — the segment endpoint resolves to
 *   true host arc distance, splits atomically and keeps Room identity plus
 *   Opening placement.
 *
 * Split by behavioural seam out of `layout-curve-regressions.test.ts`
 * (PR #115 WP3T, plan §7.6 area 2).
 */
import { describe, expect, it } from 'vitest';

import { freshCapture } from './__fixtures__/layout-id-capture';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	CURVE_FLATNESS_TOLERANCE,
	deriveChainSpans,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	planBendWallCurveKnot,
	planWallChain,
	planWallSegment,
	planWallSplit,
	sampleSegment,
	validateWallFirstTopology,
	wallCubicChain,
	wallCurveChainLength,
	wallCurveKnotArcDistance,
	wallFirstWallSpan,
	wallsShareTopologyComponent,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot,
	type NodingIdAllocator
} from '@portfolio/layout-core';

const LINE = { kind: 'line' } as const;
const CHORD = 12;

function knotsOf(...points: LayoutVec2[]): LayoutWallCurveKnot[] {
	return points.map((point, index) => ({
		id: `wall-a:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
}

function chainOf(start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]): LayoutWallCenterline {
	return wallCubicChain(knotsOf(...interior), deriveChainSpans([start, ...interior, end]));
}

function allocator(): NodingIdAllocator {
	return {
		nextWallId(base, seed) {
			let candidate = `${seed}-1`;
			let counter = 1;
			while (base.walls.some((wall) => wall.id === candidate)) {
				counter += 1;
				candidate = `${seed}-${counter}`;
			}
			return candidate;
		},
		nextJunctionId(base, seed) {
			let candidate = `j-${seed}-1`;
			let counter = 1;
			while (base.junctions.some((junction) => junction.id === candidate)) {
				counter += 1;
				candidate = `j-${seed}-${counter}`;
			}
			return candidate;
		}
	};
}

function documentOf(centerline: LayoutWallCenterline): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height: 3,
			centerline
		} as LayoutWall
	];
	return document;
}

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	return document.walls.find((wall) => wall.id === wallId)!;
}

type ChainView = {
	startPoint: LayoutVec2;
	endPoint: LayoutVec2;
	knots: readonly LayoutWallCurveKnot[];
	spans: readonly LayoutWallCubicSpan[];
};

function chainViewOf(document: LayoutDocumentWallFirst, wallId: string): ChainView {
	const wall = wallOf(document, wallId);
	if (wall.centerline.kind !== 'cubic-chain') throw new Error(`Wall '${wallId}' is not a chain`);
	const start = document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = document.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	return { startPoint: start, endPoint: end, knots: wall.centerline.knots, spans: wall.centerline.spans };
}

function segmentOf(document: LayoutDocumentWallFirst, wallId: string) {
	const view = chainViewOf(document, wallId);
	const points: LayoutVec2[] = [view.startPoint, ...view.knots.map((knot) => knot.point), view.endPoint];
	return {
		id: wallId,
		kind: 'cubic-chain' as const,
		cubics: view.spans.map((span, index) => ({
			start: points[index]!,
			handleOut: span.handleOut,
			handleIn: span.handleIn,
			end: points[index + 1]!
		}))
	};
}

function samplePointsOf(document: LayoutDocumentWallFirst, wallId: string): LayoutVec2[] {
	return sampleSegment(segmentOf(document, wallId)).samples.map((sample) => [...sample.point] as LayoutVec2);
}

function deviationFrom(point: LayoutVec2, polyline: readonly LayoutVec2[]): number {
	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < polyline.length; index += 1) {
		const start = polyline[index - 1]!;
		const end = polyline[index]!;
		const dx = end[0] - start[0];
		const dz = end[1] - start[1];
		const squared = dx * dx + dz * dz;
		const raw = squared > 0 ? ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / squared : 0;
		const amount = Math.min(1, Math.max(0, raw));
		const projected: LayoutVec2 = [start[0] + dx * amount, start[1] + dz * amount];
		best = Math.min(best, Math.hypot(point[0] - projected[0], point[1] - projected[1]));
	}
	return best;
}

function worstDeviation(points: readonly LayoutVec2[], baseline: readonly LayoutVec2[]): number {
	return Math.max(...points.map((point) => deviationFrom(point, baseline)));
}

// ===========================================================================
// Fix 2 — unified Wall arc-distance authority
// ===========================================================================

type ChainOptions = Omit<Parameters<typeof planWallChain>[0], 'capture'>;
function planWallChainCaptured(options: ChainOptions) {
	return planWallChain({ ...options, capture: freshCapture() });
}
type SegmentOptions = Omit<Parameters<typeof planWallSegment>[0], 'capture'>;
function planWallSegmentCaptured(options: SegmentOptions) {
	return planWallSegment({ ...options, capture: freshCapture() });
}

describe('P23.11 fix 2 — one authored Wall-distance metric', () => {
	const curve = () => documentOf(chainOf([0, 0], [CHORD, 0], [3, 2], [8, -1]));

	it('measures the compiled arc and the canonical Wall span with one length', () => {
		const document = curve();
		const compiled = compileWallFirstLayoutGeometry(document).geometry.walls.find(
			(wall) => wall.wallId === 'wall-a'
		)!;
		const span = wallFirstWallSpan(document, wallOf(document, 'wall-a'))!;
		const arc = wallCurveChainLength(chainViewOf(document, 'wall-a'));
		// Compiled samples, the authored Wall span and the exact chain arc all
		// report the same metres — no chord-summed reading survives.
		expect(compiled.length).toBeCloseTo(arc, 9);
		expect(span.length).toBeCloseTo(arc, 9);
	});

	it('inserts a bend point at the compiled Wall-hit distance within inversion tolerance', () => {
		const document = curve();
		const compiled = compileWallFirstLayoutGeometry(document).geometry.walls.find(
			(wall) => wall.wallId === 'wall-a'
		)!;
		// The editor authors the grabbed distance straight off the compiled
		// samples (Plan hit `projection.offset`).
		for (const fraction of [0.12, 0.37, 0.62]) {
			const index = Math.floor(fraction * (compiled.samples.length - 1));
			const authoredDistance = compiled.samples[index]!.distance;
			const plan = planBendWallCurveKnot(document, 'wall-a', {
				distance: authoredDistance,
				point: compiled.samples[index]!.point
			});
			if (plan.kind !== 'success') throw new Error('expected the bend to succeed');
			const after = chainViewOf(plan.document, 'wall-a');
			const inserted = after.knots.find((knot) => knot.id === 'wall-a:knot:3') ?? after.knots.at(-1)!;
			const arc = requireArcDistance(after, inserted.id);
			// The inserted bend point's own arc distance equals the authored hit
			// distance to the resolver's inversion tolerance — not off by the
			// sampled-vs-cubic gap that used to be ~1e-3 m.
			expect(Math.abs(arc - authoredDistance)).toBeLessThan(1e-6);
		}
	});

	it('keeps split legs legal exactly on an Opening start/end and rejects the interior', () => {
		const document = documentOf(chainOf([0, 0], [CHORD, 0], [3, 2]));
		const span = wallFirstWallSpan(document, wallOf(document, 'wall-a'))!;
		const start = span.length * 0.3;
		const width = 1.2;
		const opened: LayoutDocumentWallFirst = {
			...document,
			openings: [
				{
					id: 'opening-a',
					wallId: 'wall-a',
					kind: 'window',
					offset: start,
					width,
					height: 1.2,
					sillHeight: 0.9,
					profile: 'rectangular'
				}
			]
		};
		// Split exactly on the start edge: legal, and the Opening rebases to 0 on
		// the new fragment.
		const atStart = planWallSplit(opened, 'wall-a', start, allocator());
		expect(atStart.kind).toBe('success');
		if (atStart.kind === 'success') {
			const moved = atStart.document.openings.find((opening) => opening.id === 'opening-a')!;
			expect(moved.wallId).toBe(atStart.createdWallIds[0]);
			expect(moved.offset).toBeCloseTo(0, 9);
		}
		// Split exactly on the end edge: legal, Opening retained on the first Wall.
		const atEnd = planWallSplit(opened, 'wall-a', start + width, allocator());
		expect(atEnd.kind).toBe('success');
		if (atEnd.kind === 'success') {
			const retained = atEnd.document.openings.find((opening) => opening.id === 'opening-a')!;
			expect(retained.wallId).toBe('wall-a');
			expect(retained.offset).toBeCloseTo(start, 9);
		}
		// Split through the interior: the whole command rejects.
		const through = planWallSplit(opened, 'wall-a', start + width / 2, allocator());
		expect(through.kind).toBe('rejected');
	});
});

function requireArcDistance(view: ChainView, knotId: string): number {
	const distance = wallCurveKnotArcDistance(view, knotId);
	if (distance === undefined) throw new Error(`no knot '${knotId}'`);
	return distance;
}

// ===========================================================================
// Fix 3 — Wall authoring rejects crossings against curved Walls
// ===========================================================================

function curvedWallDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'c-a', point: [0, 0] },
		{ id: 'c-b', point: [6, 0] }
	];
	document.walls = [
		{
			id: 'curved',
			startJunctionId: 'c-a',
			endJunctionId: 'c-b',
			thickness: 0.2,
			height: 3,
			centerline: chainOf([0, 0], [6, 0], [3, 3])
		} as LayoutWall
	];
	return document;
}

function curvedBoundaryHostDocument(
	openings: ReadonlyArray<{ id: string; offset: number; width: number }> = []
): LayoutDocumentWallFirst {
	const document = curvedWallDocument();
	document.junctions.push(
		{ id: 'c-c', point: [6, 4] },
		{ id: 'c-d', point: [0, 4] }
	);
	document.walls.push(
		{ id: 'wall-right', startJunctionId: 'c-b', endJunctionId: 'c-c', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-top', startJunctionId: 'c-c', endJunctionId: 'c-d', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'wall-left', startJunctionId: 'c-d', endJunctionId: 'c-a', thickness: 0.2, height: 3, centerline: LINE }
	);
	document.rooms = [
		{
			id: 'room-curved-host',
			name: 'Curved host room',
			boundary: [
				{ wallId: 'curved', direction: 'forward' },
				{ wallId: 'wall-right', direction: 'forward' },
				{ wallId: 'wall-top', direction: 'forward' },
				{ wallId: 'wall-left', direction: 'forward' }
			],
			floorThickness: 0.1,
			ceilingThickness: 0.1
		}
	];
	document.openings = openings.map((opening) => ({
		id: opening.id,
		wallId: 'curved',
		kind: 'window' as const,
		offset: opening.offset,
		width: opening.width,
		height: 1.2,
		sillHeight: 0.9,
		profile: 'rectangular' as const
	}));
	return document;
}

function compiledWallSample(
	document: LayoutDocumentWallFirst,
	wallId: string,
	fraction: number
): { point: LayoutVec2; distance: number } {
	const wall = compileWallFirstLayoutGeometry(document).geometry.walls.find((candidate) => candidate.wallId === wallId);
	if (!wall) throw new Error(`missing compiled wall '${wallId}'`);
	const index = Math.floor(fraction * (wall.samples.length - 1));
	return {
		point: [...wall.samples[index]!.point] as LayoutVec2,
		distance: wall.samples[index]!.distance
	};
}

function compiledOpeningCenter(document: LayoutDocumentWallFirst, openingId: string): LayoutVec2 {
	const opening = compileWallFirstLayoutGeometry(document).geometry.walls
		.flatMap((wall) => wall.openings)
		.find((candidate) => candidate.openingId === openingId);
	if (!opening) throw new Error(`missing compiled opening '${openingId}'`);
	return [...opening.center.point] as LayoutVec2;
}

describe('P23.11 fix 3 — authoring crosses a curved Wall only where the component gate allows it', () => {
	it('admits a straight Wall that crosses an INDEPENDENT bow while the chord stays clear (P23B.3a S5)', () => {
		const baseline = curvedWallDocument();
		const snapshot = JSON.stringify(baseline);
		// The curved Wall's endpoint chord is z = 0 from x = 0…6. This straight
		// Wall runs at z = 2, so the chord classifier sees nothing — but it
		// crosses the bowed centerline twice. PRE-POLICY that was
		// `self_intersecting_chain`, because the chain gate compared EVERY Wall pair in
		// the document; S5 gave the gate the connected component as its subject (chord
		// loop and sampled call alike), and this Wall shares no Junction with `curved`,
		// so the crossing is permitted geometry: nothing is adopted, `curved` is not
		// split, and the canonical gate accepts what the planner built (R-3).
		const plan = planWallChainCaptured({
			baseline,
			points: [
				[1, 2],
				[5, 2]
			],
			close: false,
			levelId: baseline.floor.id,
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const authoredId = plan.createdWallIds[0]!;
		expect(plan.splitWallIds).toEqual([]);
		expect(plan.document.walls.map((wall) => wall.id)).toEqual(['curved', authoredId]);
		expect(wallsShareTopologyComponent(plan.document, 'curved', authoredId)).toBe(false);
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
		// No partial Wall/Junction/Room mutation.
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});

	it('still refuses the SAME crossing when the chain ATTACHES to the curved Wall', () => {
		// The containment half (R-1): the authored chain starts at the curved Wall's own
		// Junction `c-b`, so the two Walls are ONE component and the crossing is the
		// unsupported relation this gate exists for — same code, same diagnostic and the
		// same atomicity as before S5. The gate's subject moved; its predicate did not.
		//
		// P23B.3a S6 — "starts at the curved Wall's own Junction" is now DECLARED
		// (operation class 3), because attaching to that group is exactly what the
		// planner must be told and never infer. Remove the declaration and the same
		// crossing is admitted and un-noded, which S5's F8 case asserts.
		const baseline = curvedWallDocument();
		const snapshot = JSON.stringify(baseline);
		const plan = planWallChainCaptured({
			baseline,
			points: [
				[6, 0],
				[2, 4]
			],
			close: false,
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: 'c-b' }],
			levelId: baseline.floor.id
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		// Rejected by the canonical topology gate, not a bespoke crossing check.
		expect(plan.rejection.code).toBe('self_intersecting_chain');
		expect(plan.rejection.wallIds).toContain('curved');
		expect(plan.rejection.message).toContain('crossing away from their shared Junction');
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});

	it('accepts a valid straight Wall near but not crossing the curved Wall', () => {
		const baseline = curvedWallDocument();
		const plan = planWallChainCaptured({
			baseline,
			points: [
				[-1, 1],
				[-1, 3]
			],
			close: false,
			levelId: baseline.floor.id,
		});
		expect(plan.kind).toBe('success');
	});

	it('accepts explicit shared-Junction contact with the curved Wall', () => {
		const baseline = curvedWallDocument();
		const plan = planWallChainCaptured({
			baseline,
			points: [
				[6, 0],
				[9, 0]
			],
			close: false,
			levelId: baseline.floor.id,
		});
		expect(plan.kind).toBe('success');
	});

	it('keeps straight/straight noding regressions green', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 's-a', point: [0, 0] },
			{ id: 's-b', point: [8, 0] }
		];
		document.walls = [
			{ id: 'host', startJunctionId: 's-a', endJunctionId: 's-b', thickness: 0.2, height: 3, centerline: LINE }
		];
		// P23B.3a S6 — the author's chain attaches to the host Wall (the declaration a
		// wall-span snap makes), so the X crossing is a WITHIN-GROUP relation and is
		// noded exactly as it was before the policy. An UNDECLARED X between two
		// commands is permitted, un-noded overlap instead (F8's scoped negative half),
		// asserted immediately below.
		const plan = planWallChainCaptured({
			baseline: document,
			points: [
				[4, -3],
				[4, 3]
			],
			close: false,
			endpointHostSnaps: [{ pointIndex: 0, wallId: 'host' }],
			levelId: document.floor.id
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// The X crossing is noded, not rejected.
		expect(plan.document.walls.length).toBeGreaterThan(2);
	});

	it('leaves the same X crossing un-noded when the chain declares no connection', () => {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 's-a', point: [0, 0] },
			{ id: 's-b', point: [8, 0] }
		];
		document.walls = [
			{ id: 'host', startJunctionId: 's-a', endJunctionId: 's-b', thickness: 0.2, height: 3, centerline: LINE }
		];
		const plan = planWallChainCaptured({
			baseline: document,
			points: [
				[4, -3],
				[4, 3]
			],
			close: false,
			levelId: document.floor.id,
		});
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		// One authored Wall, one untouched host: the crossing is a permitted overlap.
		expect(plan.document.walls).toHaveLength(2);
		expect(plan.splitWallIds).toHaveLength(0);
		expect(plan.document.walls.find((wall) => wall.id === 'host')).toEqual(document.walls[0]);
	});
});

// ===========================================================================
// Fix 2 — authored endpoint T onto a curved host
// ===========================================================================

describe('P23.11 blocker 2 — authored endpoint T onto a curved host', () => {
	it('projects the normal Wall segment endpoint to true host arc distance and splits atomically', () => {
		const baseline = curvedBoundaryHostDocument();
		const hit = compiledWallSample(baseline, 'curved', 0.25);
		const plan = planWallSegmentCaptured({
			baseline,
			start: [hit.point[0], hit.point[1] - 2],
			end: hit.point,
			endpointHostWallId: 'curved',
			levelId: baseline.floor.id
		});
		if (plan.kind !== 'success') throw new Error(`expected curved T success, got ${JSON.stringify(plan.rejection)}`);

		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		const hostA = wallOf(plan.document, 'curved');
		const hostB = plan.document.walls.find(
			(wall) => wall.id !== 'curved' && wall.startJunctionId === authored.endJunctionId && wall.endJunctionId === 'c-b'
		);
		if (!hostB) throw new Error('expected the curved host continuation');
		const splitJunctionId = authored.endJunctionId;
		expect(hostA.endJunctionId).toBe(splitJunctionId);
		expect(hostB.startJunctionId).toBe(splitJunctionId);
		expect(plan.splitWallIds).toContain('curved');
		// The authored endpoint is the one canonical X identity; no duplicate
		// Junction record is allowed at the normalized curved projection.
		expect(
			plan.document.junctions.filter((junction) => junction.id === splitJunctionId)
		).toHaveLength(1);
		expect(
			plan.document.junctions.filter(
				(junction) => Math.hypot(junction.point[0] - hit.point[0], junction.point[1] - hit.point[1]) < 0.01
			)
		).toHaveLength(1);

		const before = samplePointsOf(baseline, 'curved');
		const after = [...samplePointsOf(plan.document, 'curved'), ...samplePointsOf(plan.document, hostB.id)];
		expect(worstDeviation(after, before)).toBeLessThan(0.01);
		expect(
			wallCurveChainLength(chainViewOf(plan.document, 'curved')) +
				wallCurveChainLength(chainViewOf(plan.document, hostB.id))
		).toBeCloseTo(wallCurveChainLength(chainViewOf(baseline, 'curved')), 8);
	});

	it('preserves Room identity and Opening placement while splitting a boundary host', () => {
		const seed = curvedBoundaryHostDocument([
			{ id: 'near', offset: 0.5, width: 0.5 },
			{ id: 'far', offset: 5, width: 0.5 }
		]);
		const hit = compiledWallSample(seed, 'curved', 0.4);
		const beforeNear = compiledOpeningCenter(seed, 'near');
		const beforeFar = compiledOpeningCenter(seed, 'far');
		const plan = planWallChainCaptured({
			baseline: seed,
			points: [[hit.point[0], hit.point[1] - 2], hit.point],
			close: false,
			endpointHostSnaps: [{ pointIndex: 1, wallId: 'curved' }],
			levelId: seed.floor.id
		});
		if (plan.kind !== 'success') throw new Error(`expected boundary-host T success, got ${JSON.stringify(plan.rejection)}`);
		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		const hostB = plan.document.walls.find(
			(wall) => wall.id !== 'curved' && wall.startJunctionId === authored.endJunctionId && wall.endJunctionId === 'c-b'
		)!;

		expect(plan.document.rooms.map((room) => room.id)).toEqual(['room-curved-host']);
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toContain('curved');
		expect(plan.document.rooms[0]!.boundary.map((ref) => ref.wallId)).toContain(hostB.id);
		const near = plan.document.openings.find((opening) => opening.id === 'near')!;
		const far = plan.document.openings.find((opening) => opening.id === 'far')!;
		expect(near.wallId).toBe('curved');
		expect(far.wallId).toBe(hostB.id);
		expect(compiledOpeningCenter(plan.document, 'near')[0]).toBeCloseTo(beforeNear[0], 2);
		expect(compiledOpeningCenter(plan.document, 'near')[1]).toBeCloseTo(beforeNear[1], 2);
		expect(compiledOpeningCenter(plan.document, 'far')[0]).toBeCloseTo(beforeFar[0], 2);
		expect(compiledOpeningCenter(plan.document, 'far')[1]).toBeCloseTo(beforeFar[1], 2);
	});

	it('rejects a straddling Opening atomically through the existing split gate', () => {
		const seed = curvedBoundaryHostDocument();
		const hit = compiledWallSample(seed, 'curved', 0.4);
		seed.openings = [
			{
				id: 'straddle',
				wallId: 'curved',
				kind: 'window',
				offset: hit.distance - 0.25,
				width: 0.5,
				height: 1.2,
				sillHeight: 0.9,
				profile: 'rectangular'
			}
		];
		const snapshot = JSON.stringify(seed);
		const plan = planWallSegmentCaptured({
			baseline: seed,
			start: [hit.point[0], hit.point[1] - 2],
			end: hit.point,
			endpointHostWallId: 'curved',
			levelId: seed.floor.id
		});
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('noding_rejected');
		expect(plan.rejection.message).toMatch(/opening interior/i);
		expect(JSON.stringify(seed)).toBe(snapshot);
	});

	it('leaves an unsnapped endpoint inside sampler flatness but outside acquisition disconnected', () => {
		const baseline = curvedWallDocument();
		const hit = compiledWallSample(baseline, 'curved', 0.25);
		const outside: LayoutVec2 = [hit.point[0], hit.point[1] + CURVE_FLATNESS_TOLERANCE * 0.5];
		const plan = planWallSegmentCaptured({
			baseline,
			start: [outside[0] - 0.2, outside[1]],
			end: outside,
			levelId: baseline.floor.id,
		});
		if (plan.kind !== 'success') throw new Error(`expected disconnected near-miss success, got ${JSON.stringify(plan.rejection)}`);
		expect(plan.splitWallIds).not.toContain('curved');
		expect(plan.document.walls.filter((wall) => wall.id === 'curved')).toHaveLength(1);
		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		expect(authored.endJunctionId).not.toBe('c-a');
		expect(authored.endJunctionId).not.toBe('c-b');
	});

	it('reuses an authored endpoint that resolves at an existing host Junction', () => {
		// P23B.3a S6 — the endpoint resolved onto the host Junction `c-a`, and the
		// operation declares it: adoption is what a declared anchor buys, never what a
		// sub-ulp coordinate buys on its own.
		const baseline = curvedWallDocument();
		const plan = planWallSegmentCaptured({
			baseline,
			start: [-2, 0],
			end: [5e-10, -5e-10],
			endpointJunctionSnaps: [{ pointIndex: 1, junctionId: 'c-a' }],
			levelId: baseline.floor.id
		});
		if (plan.kind !== 'success') throw new Error(`expected endpoint adoption, got ${JSON.stringify(plan.rejection)}`);
		const authored = wallOf(plan.document, plan.authoredWallIds[0]!);
		expect(authored.endJunctionId).toBe('c-a');
		expect(plan.document.walls.filter((wall) => wall.id === 'curved')).toHaveLength(1);
		expect(plan.document.junctions.filter((junction) => junction.id === 'c-a')).toHaveLength(1);
	});
});
