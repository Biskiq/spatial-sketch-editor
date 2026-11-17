/**
 * X2 §10.1 — the pure classifier.
 *
 * Every fixture is plain compiled-shaped data: a Room's floor polygon and Walls'
 * centreline bands. The classifier is the one place a near Wall is decided, so
 * these tests pin the geometry (what blocks), the two hysteresis memories (Space
 * and Wall) and the exclusions (interior content, low Walls, no Room).
 */
import { describe, expect, it } from 'vitest';
import { pointInPolygon, type CompiledPhysicalWall, type CompiledRoom, type LayoutVec2 } from '@portfolio/layout-core';
import {
	classifyNearWalls,
	inspectedSpace,
	obstructionMargin,
	insetDistance,
	sightSamples,
	STUB_HEIGHT_METERS
} from '$lib/authoring/stage/cutaway/near-wall-classify';

const FLOOR = 'floor-1';

function room(roomId: string, floorPolygon: LayoutVec2[], ceilingElevation = 3, floorElevation = 0): CompiledRoom {
	return { roomId, floorPolygon, floorElevation, ceilingElevation } as unknown as CompiledRoom;
}

function wall(
	wallId: string,
	line: LayoutVec2[],
	options: { height?: number; thickness?: number } = {}
): CompiledPhysicalWall {
	return {
		wallId,
		floorId: FLOOR,
		height: options.height ?? 3,
		thickness: options.thickness ?? 0.2,
		solidCenterlinePolylines: [line],
		samples: [],
		solidSpans: [],
		bounds3: null
	} as unknown as CompiledPhysicalWall;
}

/** A 6 × 4 Room, Walls on every boundary. */
function rectangle(): { rooms: CompiledRoom[]; walls: CompiledPhysicalWall[] } {
	return {
		rooms: [room('room', [[0, 0], [6, 0], [6, 4], [0, 4]])],
		walls: [
			wall('south', [[0, 0], [6, 0]]),
			wall('north', [[0, 4], [6, 4]]),
			wall('east', [[6, 0], [6, 4]]),
			wall('west', [[0, 0], [0, 4]])
		]
	};
}

const floors = [{ floorId: FLOOR, elevation: 0 }];

function classify(
	eye: readonly [number, number, number],
	target: readonly [number, number, number],
	scene = rectangle(),
	previous: { spaceId?: string | null; cut?: readonly string[] } = {}
) {
	return classifyNearWalls({
		eye,
		target,
		rooms: scene.rooms,
		walls: scene.walls,
		floors,
		previousSpaceId: previous.spaceId ?? null,
		previousCut: new Set(previous.cut ?? [])
	});
}

describe('inspected Space', () => {
	it('is the occupied Room when the eye stands inside one', () => {
		const scene = rectangle();
		expect(inspectedSpace({ eye: [3, 1.6, 2], target: [0, 0, 0], rooms: scene.rooms, previousRoomId: null })?.roomId).toBe('room');
	});

	it('keeps the previous Room until the target is clearly inside a new one', () => {
		const rooms = [
			room('a', [[0, 0], [3, 0], [3, 4], [0, 4]]),
			room('b', [[3, 0], [6, 0], [6, 4], [3, 4]])
		];
		const at = (x: number, previousRoomId: string | null) =>
			inspectedSpace({ eye: [0, 10, -10], target: [x, 1.2, 2], rooms, previousRoomId })?.roomId ?? null;

		expect(at(3.1, 'a')).toBe('a');
		expect(at(3.4, 'a')).toBe('b');
		expect(at(2.9, 'a')).toBe('a');
		// Clearly outside the previous Room and outside every other one: nothing.
		expect(at(9, 'a')).toBe(null);
	});

	it('reports no Room rather than inventing one', () => {
		expect(inspectedSpace({ eye: [0, 2, 0], target: [0, 1, 0], rooms: [], previousRoomId: null })).toBe(null);
	});
});

describe('obstruction and classification', () => {
	it('cuts the near south Wall from outside and leaves the rest whole', () => {
		const result = classify([3, 1.6, -5], [3, 1.2, 2]);
		expect(result.spaceId).toBe('room');
		expect(result.stubTopY).toBe(STUB_HEIGHT_METERS);
		expect([...result.cut]).toEqual(['south']);
	});

	it('does not cut anything from above the roof', () => {
		expect([...classify([3, 12, 2], [3, 1.2, 2]).cut]).toEqual([]);
	});

	it('cuts the south Wall at a low angle', () => {
		expect([...classify([3, 1.7, -8], [3, 1.2, 2]).cut]).toEqual(['south']);
	});

	it('cuts nothing when the eye stands inside a convex Room', () => {
		expect([...classify([3, 1.6, 1], [3, 1.2, 2]).cut]).toEqual([]);
	});

	it('cuts only the re-entrant Wall of an L-shaped Room', () => {
		const scene = {
			rooms: [room('l', [[0, 0], [6, 0], [6, 3], [3, 3], [3, 6], [0, 6]])],
			walls: [
				wall('south', [[0, 0], [6, 0]]),
				wall('east', [[6, 0], [6, 3]]),
				wall('notch', [[6, 3], [3, 3]]),
				wall('reentrant', [[3, 3], [3, 6]]),
				wall('north', [[3, 6], [0, 6]]),
				wall('west', [[0, 6], [0, 0]])
			]
		};
		// The eye sits in the notch (outside the L); the target is in the lower arm.
		const result = classify([5, 1.6, 6], [2, 1.2, 1.5], scene);
		expect(result.spaceId).toBe('l');
		// The re-entrant Wall blocks the lower arm; the notch's own Wall can also be
		// crossed near the shared corner, so only the far boundary Walls are pinned
		// whole here.
		expect(result.cut.has('reentrant')).toBe(true);
		expect(result.cut.has('south')).toBe(false);
		expect(result.cut.has('east')).toBe(false);
		expect(result.cut.has('west')).toBe(false);
	});

	it('never cuts a free-standing Wall wholly inside the Room', () => {
		const scene = rectangle();
		scene.walls.push(wall('freestanding', [[2, 2], [4, 2]], { height: 2 }));
		const result = classify([3, 1.6, -5], [3, 1.2, 2], scene);
		expect(result.cut.has('south')).toBe(true);
		expect(result.cut.has('freestanding')).toBe(false);
	});

	it('cuts a dividing Wall between the eye and the target', () => {
		const scene = {
			rooms: [
				room('west-room', [[0, 0], [3, 0], [3, 4], [0, 4]]),
				room('east-room', [[3, 0], [6, 0], [6, 4], [3, 4]])
			],
			walls: [
				wall('south', [[0, 0], [6, 0]]),
				wall('north', [[0, 4], [6, 4]]),
				wall('east', [[6, 0], [6, 4]]),
				wall('west', [[0, 0], [0, 4]]),
				wall('dividing', [[3, 0], [3, 4]])
			]
		};
		const result = classify([8, 1.6, 2], [1.5, 1.2, 2], scene);
		expect(result.spaceId).toBe('west-room');
		expect(result.cut.has('dividing')).toBe(true);
	});

	it('never cuts a Wall whose top is at the stub', () => {
		const scene = rectangle();
		scene.walls.push(wall('low', [[0, 0], [6, 0]], { height: STUB_HEIGHT_METERS }));
		const result = classify([3, 1.6, -5], [3, 1.2, 2], scene, { cut: ['low'] });
		expect(result.cut.has('low')).toBe(false);
	});

	it('reports nothing when no Room is inspected', () => {
		const result = classify([3, 1.6, -5], [3, 1.2, 2], { rooms: [], walls: rectangle().walls });
		expect(result.spaceId).toBe(null);
		expect(result.stubTopY).toBe(null);
		expect([...result.cut]).toEqual([]);
	});
});

describe('hysteresis', () => {
	/** A single south Wall whose top is chosen to put the margin in a band. */
	function southAt(height: number) {
		const scene = rectangle();
		scene.walls = [wall('south', [[0, 0], [6, 0]], { height })];
		return scene;
	}

	const eye = [3, 1.6, -5] as const;
	const target = [3, 1.2, 2] as const;
	// `margin = topY − min(sightline y at a crossing)`, so the height that produces
	// a chosen margin is `margin − marginAtZeroHeight`.
	const samples = sightSamples(room('room', [[0, 0], [6, 0], [6, 4], [0, 4]]));
	const marginAtZeroHeight = obstructionMargin(eye, samples, {
		wallId: 'south',
		floorElevation: 0,
		bottomY: 0,
		topY: 0,
		thickness: 0.2,
		centerlinePolylines: [[[0, 0], [6, 0]]]
	});
	const heightFor = (margin: number) => margin - marginAtZeroHeight;

	it('keeps a previous cut inside (−0.05, 0.15) and flips outside it', () => {
		const insideBand = southAt(heightFor(0.05));
		expect(classify(eye, target, insideBand).cut.has('south')).toBe(false);
		expect(classify(eye, target, insideBand, { cut: ['south'] }).cut.has('south')).toBe(true);

		const clearlyBlocking = southAt(heightFor(0.23));
		expect(classify(eye, target, clearlyBlocking).cut.has('south')).toBe(true);

		const clearlyClear = southAt(heightFor(-0.07));
		expect(classify(eye, target, clearlyClear, { cut: ['south'] }).cut.has('south')).toBe(false);
	});

	it('is deterministic and independent of Wall order', () => {
		const forward = rectangle();
		const reversed = { rooms: forward.rooms, walls: [...forward.walls].reverse() };
		const a = [...classify([3, 1.6, -5], [3, 1.2, 2], forward).cut].sort();
		const b = [...classify([3, 1.6, -5], [3, 1.2, 2], reversed).cut].sort();
		expect(b).toEqual(a);
	});

	it('exposes a positive margin only when a sight line crosses the Wall', () => {
		const wallFixture = {
			wallId: 'south',
			floorElevation: 0,
			bottomY: 0,
			topY: 3,
			thickness: 0.2,
			centerlinePolylines: [[[0, 0], [6, 0]] as LayoutVec2[]]
		};
		expect(obstructionMargin([3, 1.6, -5], [[3, 1.2, 2]], wallFixture)).toBeGreaterThan(0);
		expect(obstructionMargin([3, 1.6, 2], [[3, 1.2, 1]], wallFixture)).toBe(Number.NEGATIVE_INFINITY);
	});

	it('insetDistance is positive inside and negative outside', () => {
		const polygon: LayoutVec2[] = [[0, 0], [4, 0], [4, 4], [0, 4]];
		expect(insetDistance([2, 2], polygon)).toBeCloseTo(2, 6);
		expect(insetDistance([-1, 2], polygon)).toBeCloseTo(-1, 6);
	});

	it('keeps every sight sample inside a strongly concave Space', () => {
		// The vertex mean (1.67, 1.67) lies in the missing quadrant, outside this L.
		const polygon: LayoutVec2[] = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
		const samples = sightSamples(room('room', polygon));
		expect(samples.length).toBeGreaterThan(0);
		for (const [x, , z] of samples) {
			expect(pointInPolygon([x, z], polygon), `sample ${x}/${z}`).toBe(true);
		}
	});
});
