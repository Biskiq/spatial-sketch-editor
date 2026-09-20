import { describe, expect, it } from 'vitest';
import { LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS } from '$lib/editor/layout/layout-interaction';
import {
	LAYOUT_PLAN_GRID_STEP,
	LAYOUT_PLAN_SNAP_RADIUS_CSS_PX,
	dedupeWallSpans,
	geometryId,
	objectBoundsSnapCandidates,
	openingEdgeSnapCandidates,
	orthogonalGuideCandidates,
	pickSnapWinner,
	resolveLayoutSnap,
	resolveOpeningDragSnap,
	snapAcquisitionRadiusWorld,
	snapOwnerKey,
	snapToGridStep,
	spanSnapCandidates,
	wallIntersectionSnapCandidates,
	wallOwnerKey,
	type CompiledLayoutGeometry,
	type CompiledQuerySpan,
	type SnapCandidate
} from '@portfolio/layout-core';

function emptyGeometry(): CompiledLayoutGeometry {
	return {
		floors: [],
		rooms: [],
		walls: [],
		objects: [],
		queries: { points: [], spans: [], polygons: [], aabbs: [] },
		bounds: null
	};
}

function wallSpan(
	segmentId: string,
	start: [number, number],
	end: [number, number],
	roomId = 'r',
	startDistance = 0
): CompiledQuerySpan {
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	return {
		id: `s:${segmentId}:${startDistance}`,
		cacheKey: `k:${segmentId}:${startDistance}`,
		kind: 'wall',
		start,
		end,
		startDistance,
		endDistance: startDistance + length,
		aabb: {
			min: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
			max: [Math.max(start[0], end[0]), Math.max(start[1], end[1])]
		},
		sourceId: segmentId,
		floorId: 'f',
		roomId,
		segmentId
	};
}

function openingSpan(
	openingId: string,
	segmentId: string,
	start: [number, number],
	end: [number, number]
): CompiledQuerySpan {
	const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
	return {
		id: `o:${openingId}`,
		cacheKey: `k:${openingId}`,
		kind: 'opening',
		start,
		end,
		startDistance: 0,
		endDistance: length,
		aabb: {
			min: [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
			max: [Math.max(start[0], end[0]), Math.max(start[1], end[1])]
		},
		sourceId: openingId,
		floorId: 'f',
		roomId: 'r',
		segmentId,
		openingId
	};
}

/** Per-sample spans of the authored wall (0,4) → (4,0), one 1 m chunk. */
function negativeSlopeSpans(segmentId = 'diag', roomId = 'r'): CompiledQuerySpan[] {
	const spans: CompiledQuerySpan[] = [];
	for (let start = 0; start < 4; start += 1) {
		spans.push(wallSpan(segmentId, [start, 4 - start], [start + 1, 3 - start], roomId, start));
	}
	return spans;
}

function vertexAt(x: number, z: number, sourceId: string): CompiledLayoutGeometry['queries']['points'][number] {
	return {
		id: `q:${sourceId}`,
		cacheKey: `c:${sourceId}`,
		kind: 'vertex',
		point: [x, z],
		aabb: { min: [x, z], max: [x, z] },
		sourceId,
		floorId: 'f',
		roomId: 'r',
		segmentId: sourceId,
		sourceIndex: 0
	};
}

describe('P23.2 centralized snap constants', () => {
	it('uses the plan-ratified 0.25 m grid step and 8 CSS px acquisition radius', () => {
		expect(LAYOUT_PLAN_GRID_STEP).toBe(0.25);
		expect(LAYOUT_PLAN_SNAP_RADIUS_CSS_PX).toBe(8);
	});

	it('converts the CSS-pixel radius to world units per zoom level (zoom-stable acquisition)', () => {
		const at50 = snapAcquisitionRadiusWorld({ pixelsPerMeter: 25 });
		const at100 = snapAcquisitionRadiusWorld({ pixelsPerMeter: 50 });
		const at200 = snapAcquisitionRadiusWorld({ pixelsPerMeter: 100 });
		expect(at100).toBeCloseTo(8 / 50);
		expect(at50).toBeCloseTo(at100 * 2);
		expect(at200).toBeCloseTo(at100 / 2);
	});

	it('returns no radius for invalid zoom', () => {
		expect(snapAcquisitionRadiusWorld({ pixelsPerMeter: 0 })).toBe(0);
		expect(snapAcquisitionRadiusWorld({ pixelsPerMeter: Number.NaN })).toBe(0);
	});
});

describe('P23.2 deterministic winner order', () => {
	const junction: SnapCandidate = { point: [0, 0], kind: 'junction', sourceId: 'j1', distance: 0.3 };
	const grid: SnapCandidate = { point: [0.25, 0], kind: 'grid', sourceId: 'grid', distance: 0.05 };

	it('a valid semantic reference beats grid even when grid is closer', () => {
		expect(pickSnapWinner([grid, junction])).toEqual(junction);
		expect(pickSnapWinner([junction, grid])).toEqual(junction);
	});

	it('equal rank resolves by screen distance', () => {
		const near: SnapCandidate = { point: [1, 0], kind: 'junction', sourceId: 'j-near', distance: 0.1 };
		const far: SnapCandidate = { point: [2, 0], kind: 'junction', sourceId: 'j-far', distance: 0.2 };
		expect(pickSnapWinner([far, near])).toEqual(near);
	});

	it('equal rank and distance resolves by stable key, never iteration order', () => {
		const a: SnapCandidate = { point: [1, 0], kind: 'junction', sourceId: 'wall-a#start', distance: 0.15 };
		const b: SnapCandidate = { point: [1, 0], kind: 'junction', sourceId: 'wall-b#end', distance: 0.15 };
		const forward = pickSnapWinner([a, b]);
		const backward = pickSnapWinner([b, a]);
		expect(forward).toEqual(backward);
		expect(forward?.sourceId).toBe('wall-a#start');
	});

	it('excludes moving-target owners and exact points (raw fallback for hand-built candidates)', () => {
		const self: SnapCandidate = { point: [3, 3], kind: 'junction', sourceId: 'moving', distance: 0.01 };
		const other: SnapCandidate = { point: [3.1, 3], kind: 'junction', sourceId: 'other', distance: 0.11 };
		// Hand-built candidates predate the typed-owner field and fall back
		// to their raw sourceId.
		expect(pickSnapWinner([self, other], { excludeOwners: new Set(['moving']) })).toEqual(other);
		expect(pickSnapWinner([self], { excludePoints: [[3, 3]] })).toBeNull();
	});

	it('filters by tool/context validity via allowedKinds', () => {
		expect(pickSnapWinner([junction, grid], { allowedKinds: ['grid'] })).toEqual(grid);
	});
});

describe('P23.2 candidate families', () => {
	it('emits endpoint, midpoint, and nearest-span candidates for one wall span', () => {
		const span = { id: 'w1', start: [0, 0] as [number, number], end: [4, 0] as [number, number] };
		const radius = 0.5;
		const atStart = spanSnapCandidates(span, [0.05, 0.02], radius);
		expect(atStart.find((candidate) => candidate.sourceId === 'w1#start')).toBeTruthy();

		const atMid = spanSnapCandidates(span, [2.03, 0.02], radius);
		const mid = atMid.find((candidate) => candidate.kind === 'wall-midpoint');
		expect(mid?.point).toEqual([2, 0]);

		const onSpan = spanSnapCandidates(span, [2.5, 0.3], radius);
		const projected = onSpan.find((candidate) => candidate.kind === 'wall-span');
		expect(projected?.point).toEqual([2.5, 0]);
		expect(projected?.wallId).toBe('w1');

		const far = spanSnapCandidates(span, [10, 10], radius);
		expect(far).toHaveLength(0);
	});

	it('emits opening-edge candidates on both ends of an opening span', () => {
		const span = { id: 's1', openingId: 'door', start: [1, 0] as [number, number], end: [2, 0] as [number, number] };
		const candidates = openingEdgeSnapCandidates(span, [1.98, 0.03], 0.2);
		expect(candidates.some((candidate) => candidate.sourceId === 'door#end')).toBe(true);
	});

	it('emits rotated-object bounds edge and center candidates', () => {
		// A diamond footprint (45°-rotated square): edges are diagonal.
		const footprint: [number, number][] = [
			[1, 0],
			[2, 1],
			[1, 2],
			[0, 1]
		];
		const edges = objectBoundsSnapCandidates(footprint, 'obj', [1.01, 0.02], 0.2);
		expect(edges.some((candidate) => candidate.kind === 'object-bounds-edge')).toBe(true);
		const center = objectBoundsSnapCandidates(footprint, 'obj', [1.03, 1.02], 0.2);
		expect(center.some((candidate) => candidate.kind === 'object-bounds-center')).toBe(true);
	});

	it('emits orthogonal guide candidates relative to the active anchor, stepping the free coordinate', () => {
		// P23.13 S8 ("locked *and* stepped"): the held coordinate is *exactly* the
		// anchor's, while the free coordinate is quantized to the step (0.25 by
		// default), so a guide winner lands on the axis crossed with a grid line
		// instead of gliding with the pointer.
		const candidates = orthogonalGuideCandidates([1, 1], [3.1, 1.6]);
		const x = candidates.find((candidate) => candidate.sourceId === 'orthogonal-x');
		const z = candidates.find((candidate) => candidate.sourceId === 'orthogonal-z');
		expect(x?.point).toEqual([3, 1]);
		expect(z?.point).toEqual([1, 1.5]);
		expect(orthogonalGuideCandidates([1, 1], [3.1, 1.6], 1).map((candidate) => candidate.point)).toEqual(
			[
				[3, 1],
				[1, 2]
			]
		);
		// Acquisition still reads the raw perpendicular offset, never the stepped
		// one, so which probe wins where is unchanged by the stepping.
		expect(x?.distance).toBeCloseTo(0.6, 9);
		expect(z?.distance).toBeCloseTo(2.1, 9);
	});

	it('emits valid wall-wall intersections only for endpoint-on-interior and proper-crossing', () => {
		const spans = [
			{ id: 'h', start: [0, 0] as [number, number], end: [4, 0] as [number, number] },
			{ id: 'tee', start: [2, 0] as [number, number], end: [2, 3] as [number, number] },
			{ id: 'far', start: [0, 5] as [number, number], end: [4, 5] as [number, number] }
		];
		const candidates = wallIntersectionSnapCandidates(spans, [2.04, 0.03], 0.3);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]).toMatchObject({ kind: 'wall-intersection', point: [2, 0] });
	});
});

describe('P23.2 resolveLayoutSnap over compiled query geometry', () => {
	it('snaps to a compiled junction point and beats the grid fallback', () => {
		const geometry = emptyGeometry();
		geometry.queries.points.push(vertexAt(2, 0, 'seg-a'));
		const resolution = resolveLayoutSnap(geometry, [2.04, 0.02], { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'junction', point: [2, 0] });
	});

	it('falls back to the grid when no semantic candidate is in range', () => {
		const resolution = resolveLayoutSnap(emptyGeometry(), [2.34, 1.11], { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'grid', point: [2.25, 1] });
	});

	it('honors exclusion of the moving target inside resolveLayoutSnap', () => {
		const geometry = emptyGeometry();
		geometry.queries.points.push(vertexAt(2, 0, 'moving-segment'));
		const resolution = resolveLayoutSnap(geometry, [2.01, 0.01], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'moving-segment' })])
		});
		if (resolution.kind === 'snap') {
			expect(resolution.candidate.sourceId).not.toBe('moving-segment');
		}
	});

	it('keeps coincident junctions from distinct walls when deduping, so excluding one leaves the other regardless of query order', () => {
		const ownerOf = (id: string) => snapOwnerKey({ kind: 'wall', id });

		const buildGeometry = (order: 'ab' | 'ba'): CompiledLayoutGeometry => {
			const geometry = emptyGeometry();
			const points = [
				vertexAt(0, 0, 'wall-a'),
				vertexAt(0, 0, 'wall-b')
			];
			geometry.queries.points.push(...(order === 'ab' ? points : [...points].reverse()));
			return geometry;
		};

		for (const order of ['ab', 'ba'] as const) {
			const excluded = resolveLayoutSnap(buildGeometry(order), [0.01, 0.01], { pixelsPerMeter: 50 }, {
				excludeOwners: new Set([ownerOf('wall-a')])
			});
			expect(excluded.kind).toBe('snap');
			if (excluded.kind !== 'snap') continue;
			// wall-a's junction must not shadow wall-b's coincident one.
			expect(excluded.candidate.sourceId).toBe('wall-b');
			expect(excluded.candidate.ownerId).toBe(ownerOf('wall-b'));

			const unexcluded = resolveLayoutSnap(buildGeometry(order), [0.01, 0.01], { pixelsPerMeter: 50 });
			expect(unexcluded.kind).toBe('snap');
			if (unexcluded.kind !== 'snap') continue;
			// No exclusion: the winner is decided by the stable key (smallest
			// owner id), never by which coincident record came first.
			expect(unexcluded.candidate.sourceId).toBe('wall-a');
			expect(unexcluded.candidate.ownerId).toBe(ownerOf('wall-a'));
		}
	});

	it('snapToGridStep respects the centralized step and invalid steps pass through', () => {
		expect(snapToGridStep([1.13, -0.62])).toEqual([1.25, -0.5]);
		expect(snapToGridStep([1.13, 1], 0)).toEqual([1.13, 1]);
	});
});

describe('P23.2 negative-slope wall geometry', () => {
	it('merges a negative-slope wall to its true endpoint pair, not the bounding-box anti-diagonal', () => {
		// Authored (0,4) → (4,0): a min/max merge would produce the fake
		// anti-diagonal (0,0) → (4,4).
		const merged = dedupeWallSpans(negativeSlopeSpans());
		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({
			key: 'diag',
			segmentId: 'diag',
			start: [0, 4],
			end: [4, 0],
			straight: true
		});
		expect(merged[0].samples).toHaveLength(4);
	});

	it('merges reversed shared negative-slope spans across rooms into the true endpoint pair', () => {
		// Room 'a' traverses (0,4) → (4,0); room 'b' traverses the same wall
		// reversed, (4,0) → (0,4), so startDistance is per-room and cannot be
		// compared across rooms.
		const spans: CompiledQuerySpan[] = [...negativeSlopeSpans('diag', 'a')];
		for (let start = 0; start < 4; start += 1) {
			spans.push(wallSpan('diag', [4 - start, start], [3 - start, start + 1], 'b', start));
		}
		const merged = dedupeWallSpans(spans);
		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({ key: 'diag', start: [0, 4], end: [4, 0], straight: true });
	});

	it('never merges same-named segments of different legacy rooms into one fake wall', () => {
		// Legacy segment ids are only unique inside each room: room 'a' and
		// room 'b' both own a wall-1, at different locations. A bare
		// segmentId group would collapse them into one fake wall spanning
		// (0,4) → (14,0).
		const spans: CompiledQuerySpan[] = negativeSlopeSpans('wall-1', 'room-a').map((span) => ({
			...span,
			wallKey: 'f:room-a:wall-1'
		}));
		for (let start = 0; start < 4; start += 1) {
			spans.push({
				...wallSpan('wall-1', [10 + start, 0], [11 + start, 0], 'room-b', start),
				wallKey: 'f:room-b:wall-1'
			});
		}
		const merged = dedupeWallSpans(spans);
		expect(merged.map((merge) => merge.key).sort()).toEqual(['f:room-a:wall-1', 'f:room-b:wall-1']);
		expect(merged.find((merge) => merge.key === 'f:room-b:wall-1')).toMatchObject({
			segmentId: 'wall-1',
			start: [10, 0],
			end: [14, 0],
			straight: true
		});
	});

	it('keeps curved wall samples and never invents straight chord semantics', () => {
		// A two-chord arc through (1,1): the sample path (2√2) is longer than
		// the (0,0)→(2,0) chord (2), so the wall is curved and must keep its
		// per-sample spans instead of a straight merge.
		const merged = dedupeWallSpans([
			wallSpan('arc', [0, 0], [1, 1]),
			wallSpan('arc', [1, 1], [2, 0])
		]);
		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({ key: 'arc', segmentId: 'arc', straight: false });
		expect(merged[0].samples).toHaveLength(2);
	});

	it('resolves the midpoint of a negative-slope wall on the true geometry', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(...negativeSlopeSpans());
		const resolution = resolveLayoutSnap(geometry, [2.02, 1.98], { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'wall-midpoint', point: [2, 2] });
	});

	it('resolves the endpoint of a negative-slope wall on the true geometry', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(...negativeSlopeSpans());
		const resolution = resolveLayoutSnap(geometry, [0.04, 3.96], { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({
			kind: 'junction',
			point: [0, 4],
			sourceId: 'diag#start'
		});
	});

	it('computes a proper crossing on a negative-slope wall at the true intersection', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(
			...negativeSlopeSpans(),
			wallSpan('vertical', [2, 0], [2, 3])
		);
		const resolution = resolveLayoutSnap(geometry, [2.04, 2.03], { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'wall-intersection', point: [2, 2] });
	});
});

describe('P23.2 legacy room-qualified wall identity', () => {
	it('resolves a legacy room wall-1 without contamination from another room wall-1', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(
			...negativeSlopeSpans('wall-1', 'room-a').map((span) => ({
				...span,
				wallKey: 'f:room-a:wall-1'
			}))
		);
		for (let start = 0; start < 4; start += 1) {
			geometry.queries.spans.push({
				...wallSpan('wall-1', [10 + start, 0], [11 + start, 0], 'room-b', start),
				wallKey: 'f:room-b:wall-1'
			});
		}
		// Pointer near room B wall-1 start: the true junction lives there.
		// Without room-qualified identity the two walls merge into one fake
		// wall and no junction exists at (10,0).
		const resolution = resolveLayoutSnap(geometry, [10.03, 0.02], { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({
			kind: 'junction',
			point: [10, 0],
			sourceId: 'f:room-b:wall-1#start'
		});
	});
});

describe('P23.2 curved wall snapping', () => {
	it('snaps to the curve itself, not a straight chord through its interior', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('arc', [0, 0], [1, 1]), wallSpan('arc', [1, 1], [2, 0]));
		// Pointer at the curve apex (1,1) — on the curve, far from the chord.
		const atApex = resolveLayoutSnap(geometry, [1.0, 1.0], { pixelsPerMeter: 50 });
		expect(atApex.kind).toBe('snap');
		if (atApex.kind !== 'snap') return;
		expect(atApex.candidate).toMatchObject({ kind: 'wall-span', point: [1, 1], wallId: 'arc' });
	});

	it('never invents a straight midpoint on a curved wall', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('arc', [0, 0], [1, 1]), wallSpan('arc', [1, 1], [2, 0]));
		// Pointer near the chord interior (1,0) is NOT on the curve: only the
		// grid fallback may win. A straight-wall merge would invent a
		// wall-midpoint here.
		const atChord = resolveLayoutSnap(geometry, [1.0, 0.05], { pixelsPerMeter: 50 });
		expect(atChord.kind).toBe('snap');
		if (atChord.kind !== 'snap') return;
		expect(atChord.candidate.kind).toBe('grid');
	});
});

describe('P23.2 moving-target exclusion by typed owner', () => {
	it('excludes a moving object own bounds-edge candidates even though sourceId is composite', () => {
		const geometry = emptyGeometry();
		geometry.queries.polygons.push({
			id: 'p:obj',
			cacheKey: 'c:obj',
			kind: 'object-footprint',
			polygon: [[0, 0], [1, 0], [1, 1], [0, 1]],
			aabb: { min: [0, 0], max: [1, 1] },
			sourceId: 'obj',
			objectId: 'obj'
		});
		// Pointer at the own edge midpoint: the candidate is 'obj#0:mid'
		// (sourceId ≠ 'obj'), sharing its world point with the grid fallback.
		const unexcluded = resolveLayoutSnap(geometry, [0.5, 0.03], { pixelsPerMeter: 50 });
		expect(unexcluded.kind).toBe('snap');
		if (unexcluded.kind !== 'snap') return;
		expect(unexcluded.candidate).toMatchObject({
			kind: 'object-bounds-edge',
			sourceId: 'obj#0:mid',
			ownerId: snapOwnerKey({ kind: 'object', id: 'obj' })
		});
		const excluded = resolveLayoutSnap(geometry, [0.5, 0.03], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'object', id: 'obj' })])
		});
		expect(excluded.kind).toBe('snap');
		if (excluded.kind !== 'snap') return;
		expect(excluded.candidate.kind).toBe('grid');
	});

	it('excludes a moving wall segment endpoint candidates like `w#start` by owner', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('w', [0, 0], [4, 0]));
		const unexcluded = resolveLayoutSnap(geometry, [0.02, 0.01], { pixelsPerMeter: 50 });
		expect(unexcluded.kind).toBe('snap');
		if (unexcluded.kind !== 'snap') return;
		expect(unexcluded.candidate).toMatchObject({ kind: 'junction', sourceId: 'w#start' });
		const excluded = resolveLayoutSnap(geometry, [0.02, 0.01], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'w' })])
		});
		expect(excluded.kind).toBe('snap');
		if (excluded.kind !== 'snap') return;
		expect(excluded.candidate.kind).toBe('grid');
	});

	it('excludes intersections involving the moving wall even though their owner is composite', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('h', [0, 0], [4, 0]), wallSpan('v', [2, -1], [2, 3]));
		// Without exclusion the proper crossing at (2,0) wins by rank.
		const unexcluded = resolveLayoutSnap(geometry, [2.03, 0.02], { pixelsPerMeter: 50 });
		expect(unexcluded.kind).toBe('snap');
		if (unexcluded.kind !== 'snap') return;
		expect(unexcluded.candidate).toMatchObject({ kind: 'wall-intersection', point: [2, 0] });
		// Dragging wall 'h' excludes its own intersections ('h~v' can never
		// exact-match the bare exclusion id), so the crossing is removed
		// before classification: the static wall's nearest point wins.
		const excluded = resolveLayoutSnap(geometry, [2.03, 0.02], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'h' })])
		});
		expect(excluded.kind).toBe('snap');
		if (excluded.kind !== 'snap') return;
		expect(excluded.candidate.kind).not.toBe('wall-intersection');
		expect(excluded.candidate.kind).toBe('wall-span');
	});
});

describe('P23.2 typed, collision-safe ownership', () => {
	it('never lets an object exclusion suppress same-named wall candidates and vice versa', () => {
		const geometry = emptyGeometry();
		// Object `foo` and wall `foo` legally coexist.
		geometry.queries.polygons.push({
			id: 'p:foo',
			cacheKey: 'c:foo',
			kind: 'object-footprint',
			polygon: [[0, 0], [1, 0], [1, 1], [0, 1]],
			aabb: { min: [0, 0], max: [1, 1] },
			sourceId: 'foo',
			objectId: 'foo'
		});
		geometry.queries.spans.push(wallSpan('foo', [0, 0], [4, 0]));
		// Pointer near both the wall start and the object corner.
		const excludeObject = resolveLayoutSnap(geometry, [0.02, 0.01], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'object', id: 'foo' })])
		});
		expect(excludeObject.kind).toBe('snap');
		if (excludeObject.kind !== 'snap') return;
		// The wall junction survives: a bare-id owner would have killed it.
		expect(excludeObject.candidate).toMatchObject({ kind: 'junction', sourceId: 'foo#start' });

		const excludeWall = resolveLayoutSnap(geometry, [0.02, 0.01], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'foo' })])
		});
		expect(excludeWall.kind).toBe('snap');
		if (excludeWall.kind !== 'snap') return;
		// The object bounds edge survives.
		expect(excludeWall.candidate.kind).toBe('object-bounds-edge');
	});

	it('never lets one legacy room wall-1 exclusion suppress another room wall-1', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(
			...negativeSlopeSpans('wall-1', 'room-a').map((span) => ({
				...span,
				wallKey: 'f:room-a:wall-1'
			})),
			...negativeSlopeSpans('wall-1', 'room-b').map((span) => ({
				...span,
				wallKey: 'f:room-b:wall-1'
			}))
		);
		// Moving room-a's wall-1 must leave room-b's wall-1 junction intact.
		const resolution = resolveLayoutSnap(geometry, [0.03, 3.97], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'f:room-a:wall-1' })])
		});
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({
			kind: 'junction',
			point: [0, 4],
			sourceId: 'f:room-b:wall-1#start'
		});
	});

	it('never merges walls whose naive id joining would collide', () => {
		// (floor f, room 'a:b', segment 'c') and (floor f, room 'a', segment
		// 'b:c') both naively join to 'f:a:b:c' — length-prefixed keys keep
		// them apart, exactly like the compiler's legacy wallKey.
		const wallA = geometryId(['f', 'a:b', 'c']);
		const wallB = geometryId(['f', 'a', 'b:c']);
		expect(wallA).not.toBe(wallB);
		const spans = [
			{ ...wallSpan('wall-1', [0, 0], [4, 0], 'a:b'), wallKey: wallA },
			{ ...wallSpan('wall-1', [10, 0], [14, 0], 'a'), wallKey: wallB }
		];
		expect(dedupeWallSpans(spans)).toHaveLength(2);
	});

	it('resolves the qualified wall owner key from the compiled geometry', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push({
			...wallSpan('wall-1', [0, 0], [4, 0], 'room-a'),
			wallKey: 'f:room-a:wall-1'
		});
		// Legacy: qualified by the moving room.
		expect(wallOwnerKey(geometry, 'room-a', 'wall-1')).toBe(
			snapOwnerKey({ kind: 'wall', id: 'f:room-a:wall-1' })
		);
		// Another room's same-named segment does not qualify this owner.
		expect(wallOwnerKey(geometry, 'room-b', 'wall-1')).toBe(
			snapOwnerKey({ kind: 'wall', id: 'wall-1' })
		);
		// Hand-built/empty geometry falls back to the bare segment id.
		expect(wallOwnerKey(emptyGeometry(), 'room-a', 'wall-1')).toBe(
			snapOwnerKey({ kind: 'wall', id: 'wall-1' })
		);
	});
});

describe('P23.2 opening drag resolution (offset space)', () => {
	// 6 m host wall authored (0,0) → (6,0); door width 0.9. Default radius
	// 8 CSS px at 50 px/m = 0.16 m unless overridden.
	const host = { segmentId: 'w', start: [0, 0] as [number, number], end: [6, 0] as [number, number] };

	it('falls back to the grid, center-snapped like opening creation', () => {
		const resolution = resolveOpeningDragSnap(emptyGeometry(), host, 'door', 0.53, 0.9, { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'grid', sourceId: 'grid' });
		expect(resolution.candidate.offset).toBeCloseTo(0.05, 6);
	});

	it('flushes the opening to the wall start and end junctions', () => {
		const start = resolveOpeningDragSnap(emptyGeometry(), host, 'door', 0.1, 0.9, { pixelsPerMeter: 50 });
		expect(start.kind).toBe('snap');
		if (start.kind !== 'snap') return;
		expect(start.candidate).toMatchObject({ kind: 'junction', sourceId: 'w#start', offset: 0 });

		const end = resolveOpeningDragSnap(emptyGeometry(), host, 'door', 5.9, 0.9, { pixelsPerMeter: 50 });
		expect(end.kind).toBe('snap');
		if (end.kind !== 'snap') return;
		expect(end.candidate).toMatchObject({ kind: 'junction', sourceId: 'w#end' });
		expect(end.candidate.offset).toBeCloseTo(5.1, 6);
	});

	it('centers the opening on the host wall midpoint', () => {
		const resolution = resolveOpeningDragSnap(emptyGeometry(), host, 'door', 3.02, 0.9, { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'wall-midpoint', sourceId: 'w' });
		expect(resolution.candidate.offset).toBeCloseTo(2.55, 6);
	});

	it('never snaps the dragged opening to its own edges (self-snap loop)', () => {
		const geometry = emptyGeometry();
		// Dragged door currently at offset 0.5..1.4 (center 0.95).
		geometry.queries.spans.push(openingSpan('door', 'w', [0.5, 0], [1.4, 0]));
		// Pointer 0.96 is 0.01 m from the opening own center — without the
		// exclusion its own start edge would win by rank and the opening
		// would stick at 0.5 forever.
		const resolution = resolveOpeningDragSnap(geometry, host, 'door', 0.96, 0.9, { pixelsPerMeter: 50 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'grid', sourceId: 'grid' });
		expect(resolution.candidate.offset).toBeCloseTo(0.55, 6);
	});

	it('aligns the approaching edge to another opening edge on the same wall', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(openingSpan('other', 'w', [3, 0], [3.9, 0]));
		const resolution = resolveOpeningDragSnap(geometry, host, 'door', 2.9, 0.9, {
			pixelsPerMeter: 50,
			snapRadiusCssPx: 100
		});
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		// Dragged door end edge lands on the other door start edge: 2.1 + 0.9 = 3.0.
		expect(resolution.candidate).toMatchObject({ kind: 'opening-edge', sourceId: 'other#start' });
		expect(resolution.candidate.offset).toBeCloseTo(2.1, 6);
	});

	it('resolves in the authored segment frame for a reversed shared wall', () => {
		const geometry = emptyGeometry();
		// Host wall authored (6,0) → (0,0) (room traverses right-to-left);
		// the other opening sits at authored offset 3.0..3.9 (world x 3.0..2.1).
		const reversedHost = { segmentId: 'w', start: [6, 0] as [number, number], end: [0, 0] as [number, number] };
		geometry.queries.spans.push(openingSpan('other', 'w', [3, 0], [2.1, 0]));
		const resolution = resolveOpeningDragSnap(geometry, reversedHost, 'door', 2.9, 0.9, {
			pixelsPerMeter: 50,
			snapRadiusCssPx: 100
		});
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'opening-edge', sourceId: 'other#start' });
		expect(resolution.candidate.offset).toBeCloseTo(2.1, 6);
	});

	it('returns none when the acquisition radius is invalid', () => {
		const resolution = resolveOpeningDragSnap(emptyGeometry(), host, 'door', 0.53, 0.9, { pixelsPerMeter: 0 });
		expect(resolution.kind).toBe('none');
	});

	it('ignores openings on same-named segments of other legacy rooms', () => {
		const geometry = emptyGeometry();
		// Host door on room 'r' wall 'w' at offset 0.5..1.4.
		geometry.queries.spans.push(openingSpan('door', 'w', [0.5, 0], [1.4, 0]));
		// Another room owns a different wall 'w' with its own opening at
		// authored offset 3.0..3.9 (room-scoped identity).
		geometry.queries.spans.push({
			...openingSpan('other', 'w', [3, 0], [3.9, 0]),
			roomId: 'other-room',
			wallKey: 'f:other-room:w'
		});
		const resolution = resolveOpeningDragSnap(geometry, host, 'door', 2.9, 0.9, {
			pixelsPerMeter: 50,
			snapRadiusCssPx: 100
		});
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		// The other room's opening must NOT be a candidate: the host wall
		// midpoint resolves instead (opening-edge would win otherwise).
		expect(resolution.candidate.kind).toBe('wall-midpoint');
		expect(resolution.candidate.offset).toBeCloseTo(2.55, 6);
	});
});

// ---------------------------------------------------------------------------
// P23.10 review — direct-edit filters reach the resolver untouched
// ---------------------------------------------------------------------------
describe('P23.10 review — direct-edit family filters inside resolveLayoutSnap', () => {
	it('filters the junction family for a Junction move so a lower-ranked family wins', () => {
		const geometry = emptyGeometry();
		// A wall running along z=0 with a stationary T-junction landing on its
		// midpoint: the two candidates are coincident, so only the filter decides.
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [4, 0]));
		geometry.queries.points.push(vertexAt(2, 0, 'wall-b'));

		const unfiltered = resolveLayoutSnap(geometry, [2.02, 0.02], { pixelsPerMeter: 50 });
		expect(unfiltered.kind).toBe('snap');
		if (unfiltered.kind !== 'snap') return;
		expect(unfiltered.candidate.kind).toBe('junction');

		// A Junction move must never merge into another Junction, so the family
		// is removed before winner selection — the midpoint is then accepted.
		const filtered = resolveLayoutSnap(geometry, [2.02, 0.02], { pixelsPerMeter: 50 }, {
			allowedKinds: [...LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS]
		});
		expect(filtered.kind).toBe('snap');
		if (filtered.kind !== 'snap') return;
		expect(filtered.candidate.kind).toBe('wall-midpoint');
		expect(filtered.candidate.point).toEqual([2, 0]);
	});

	it('excludes a Junction coordinate a projective family would otherwise land on', () => {
		// Regression (direct Junction edit): the family filter alone still leaves
		// `'wall-span'` free to project onto the exact coordinate of a Junction
		// that sits on another Wall's span — a position the planner rejects,
		// because Junction merging is out of scope.
		const geometry = emptyGeometry();
		// One 6 m Wall plus a stationary Junction on its exact midpoint, so the
		// forbidden coordinate is reachable through the midpoint, span-start/end
		// and grid families as well as the filtered `'junction'` one.
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [6, 0]));
		geometry.queries.points.push(vertexAt(3, 0, 'wall-b'));

		const unfiltered = resolveLayoutSnap(geometry, [3.02, 0.01], { pixelsPerMeter: 50 });
		expect(unfiltered.kind).toBe('snap');
		if (unfiltered.kind !== 'snap') return;
		expect(unfiltered.candidate).toMatchObject({ kind: 'junction', point: [3, 0] });

		const familyFiltered = resolveLayoutSnap(geometry, [3.02, 0.01], { pixelsPerMeter: 50 }, {
			allowedKinds: [...LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS]
		});
		expect(familyFiltered.kind).toBe('snap');
		if (familyFiltered.kind !== 'snap') return;
		// Still the forbidden coordinate, now through `'wall-midpoint'`.
		expect(familyFiltered.candidate.point).toEqual([3, 0]);
		expect(familyFiltered.candidate.kind).not.toBe('junction');

		const pointExcluded = resolveLayoutSnap(geometry, [3.02, 0.01], { pixelsPerMeter: 50 }, {
			allowedKinds: [...LAYOUT_ARCHITECTURE_JUNCTION_SNAP_KINDS],
			excludePoints: [[3, 0]]
		});
		expect(pointExcluded.kind).toBe('snap');
		if (pointExcluded.kind !== 'snap') return;
		// The occupied coordinate is unreachable; the ordinary projection wins.
		expect(pointExcluded.candidate.kind).toBe('wall-span');
		expect(pointExcluded.candidate.point[0]).toBeCloseTo(3.02, 9);
		expect(pointExcluded.candidate.point[1]).toBe(0);
	});

	it('excludes both endpoints of a moving Wall so a farther stationary Junction wins', () => {
		// A rigid Wall move keeps the junction family (one delta merges no IDs)
		// but must never snap back onto its own translation group: one owner key
		// covers both endpoints, so a different owner is free to win.
		const geometry = emptyGeometry();
		geometry.queries.points.push(
			vertexAt(0, 0, 'wall-moving'),
			vertexAt(4, 0, 'wall-moving'),
			vertexAt(0.2, 0, 'wall-stationary')
		);
		const raw = resolveLayoutSnap(geometry, [0.05, 0.02], { pixelsPerMeter: 50 });
		expect(raw.kind).toBe('snap');
		if (raw.kind !== 'snap') return;
		expect(raw.candidate.sourceId).toBe('wall-moving');

		const excluded = resolveLayoutSnap(geometry, [0.05, 0.02], { pixelsPerMeter: 50 }, {
			excludeOwners: new Set([snapOwnerKey({ kind: 'wall', id: 'wall-moving' })])
		});
		expect(excluded.kind).toBe('snap');
		if (excluded.kind !== 'snap') return;
		expect(excluded.candidate).toMatchObject({ kind: 'junction', sourceId: 'wall-stationary' });
		expect(excluded.candidate.point).toEqual([0.2, 0]);
	});
});

describe('P23.6e review — the grid floor cannot widen semantic acquisition', () => {
	// The grid fallback may accept a wider band than the fixed 8 CSS-pixel
	// semantic radius. That fallback must not turn a nearby-but-unacquired wall
	// into a semantic hit.
	it('a click outside the 8 CSS-pixel wall radius stays on the grid', () => {
		const geometry = emptyGeometry();
		// One straight wall along z=0 from x=0 to x=6.
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [6, 0]));
		// 150 px/m → 8 CSS px = 0.053 m. This click is 0.07 m (10.5 CSS px)
		// off the wall, so it is outside semantic acquisition but inside the grid
		// fallback band.
		const resolution = resolveLayoutSnap(geometry, [2.4, 0.07], { pixelsPerMeter: 150 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'grid', point: [2.5, 0] });
	});

	it('a click outside the 8 CSS-pixel junction radius stays on the grid', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [6, 0]));
		// A T-junction where another wall lands mid-span.
		geometry.queries.points.push(vertexAt(3, 0, 'wall-b'));
		const resolution = resolveLayoutSnap(geometry, [3.08, 0.08], { pixelsPerMeter: 150 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('grid');
	});

	it('custom grid size never changes semantic acquisition distance', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [6, 0]));
		// 200 px/m → 8 CSS px = 0.04 m. The 0.07 m gap is outside the
		// semantic radius, even though a 1 m grid accepts the pointer.
		const resolution = resolveLayoutSnap(geometry, [2.4, 0.07], {
			pixelsPerMeter: 200,
			gridStep: 1
		});
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate).toMatchObject({ kind: 'grid', point: [2, 0] });
	});

	it('the grid still wins when nothing semantic is inside its band', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [6, 0]));
		// 0.3 m off the wall: beyond step/2, so neither semantic nor grid.
		const resolution = resolveLayoutSnap(geometry, [2.4, 0.3], { pixelsPerMeter: 150 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('grid');
	});

	it('zoomed-out views keep the previous behavior (radius already covers step/2)', () => {
		const geometry = emptyGeometry();
		geometry.queries.spans.push(wallSpan('boundary', [0, 0], [6, 0]));
		// At 60 px/m the semantic radius is 0.133 m > 0.125 m; identical
		// outcome before and after the fix.
		const resolution = resolveLayoutSnap(geometry, [2.4, 0.1], { pixelsPerMeter: 60 });
		expect(resolution.kind).toBe('snap');
		if (resolution.kind !== 'snap') return;
		expect(resolution.candidate.kind).toBe('wall-span');
	});
});
