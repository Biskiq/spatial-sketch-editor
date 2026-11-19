/**
 * X2 §10.1.5 — the Junction catalogue.
 *
 * Every representative Junction (tangent continuation, L, T, X, thickness step,
 * height step, curved leg) is cut in every combination of its legs. A cut
 * component must assemble with **zero** issues and must not fall back to whole
 * (D12), and every cut/uncut pair at the Junction must produce at least one
 * vertical seam face — the face that closes the stub against the neighbour that
 * stayed whole.
 *
 * Closure is tested on the boundary X2 actually introduces: the horizontal cut
 * plane. The compiled Wall meshes are watertight elsewhere (their own matrix),
 * and a seam's vertical/top edges are the intentional free edge of the paper
 * face above the stub. A whole-soup parity check would therefore flag the
 * representation's deliberate Junction-interface openings and seam paper, not an
 * X2 defect. At the stub plane, clipping each cut Wall leaves boundary edges;
 * the cap loops and the closing seam bottoms must weld to them. Every elementary
 * segment of that plane must be covered exactly twice — once by the Wall or seam
 * boundary and once by the cap boundary. Endpoint membership alone is not enough:
 * this catches an unmatched Wall edge, a seam that misses the cap, a cap edge
 * with no closure, and duplicate/overlapping seam faces.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	deriveChainSpans,
	legJoinsByWall,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';
import { assembleCutawayCaps, type CutawayComponent } from '$lib/authoring/stage/cutaway/cutaway-caps';
import { capFillsOf } from '$lib/authoring/stage/slice/slice-cap-shapes';

/** Weld tolerance for the cut plane, documented in §3.5 (0.1 mm). */
const WELD_TOLERANCE = 1e-4;

type PlanPoint = readonly [number, number];
type Vec3 = readonly [number, number, number];
type Triangle = readonly [Vec3, Vec3, Vec3];

type BoundarySegment = {
	readonly a: PlanPoint;
	readonly b: PlanPoint;
	/** `wall`, `cap` or `seam`; used only in failure diagnostics. */
	readonly kind: 'wall' | 'cap' | 'seam';
	readonly owner: string;
};

type WeldedSource = {
	readonly identity: string;
	readonly positions: ArrayLike<number>;
	readonly index: ArrayLike<number>;
};

const planKey = (point: PlanPoint): string =>
	`${Math.round(point[0] / WELD_TOLERANCE)},${Math.round(point[1] / WELD_TOLERANCE)}`;

const pointKey = (point: Vec3): string =>
	`${Math.round(point[0] / WELD_TOLERANCE)},${Math.round(point[1] / WELD_TOLERANCE)},${Math.round(point[2] / WELD_TOLERANCE)}`;

/** Sutherland–Hodgman against `y <= cutY`, returning a triangle fan. */
function clipTriangleBelow(triangle: Triangle, cutY: number): Triangle[] {
	const polygon: Vec3[] = [];
	for (let index = 0; index < 3; index += 1) {
		const current = triangle[index]!;
		const next = triangle[(index + 1) % 3]!;
		const currentInside = current[1] <= cutY + 1e-9;
		const nextInside = next[1] <= cutY + 1e-9;
		if (currentInside) polygon.push(current);
		if (currentInside !== nextInside) {
			const t = (cutY - current[1]) / (next[1] - current[1]);
			polygon.push([
				current[0] + (next[0] - current[0]) * t,
				cutY,
				current[2] + (next[2] - current[2]) * t
			]);
		}
	}
	const out: Triangle[] = [];
	for (let index = 1; index + 1 < polygon.length; index += 1) {
		out.push([polygon[0]!, polygon[index]!, polygon[index + 1]!]);
	}
	return out;
}

/**
 * The odd-multiplicity triangle edges of a cut Wall after clipping. A compiled
 * Wall is a closed surface, so an interior edge is shared by two triangles and
 * only the newly cut boundary is odd. Coincident duplicate faces would also be
 * odd at multiplicity three; that is deliberately retained and fails the
 * two-cover rule below.
 */
function wallCutPlaneEdges(source: WeldedSource, cutY: number): BoundarySegment[] {
	const pointAt = (index: number): Vec3 => [
		source.positions[index * 3]!,
		source.positions[index * 3 + 1]!,
		source.positions[index * 3 + 2]!
	];
	const triangles: Triangle[] = [];
	for (let index = 0; index < source.index.length; index += 3) {
		const triangle: Triangle = [
			pointAt(source.index[index]!),
			pointAt(source.index[index + 1]!),
			pointAt(source.index[index + 2]!)
		];
		triangles.push(...clipTriangleBelow(triangle, cutY));
	}
	const edges = new Map<string, { a: Vec3; b: Vec3; count: number }>();
	for (const triangle of triangles) {
		for (let index = 0; index < 3; index += 1) {
			const a = triangle[index]!;
			const b = triangle[(index + 1) % 3]!;
			const ka = pointKey(a);
			const kb = pointKey(b);
			const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
			const current = edges.get(key);
			if (current === undefined) edges.set(key, { a, b, count: 1 });
			else current.count += 1;
		}
	}
	return [...edges.values()]
		.filter(
			(edge) =>
				edge.count % 2 === 1 &&
				Math.abs(edge.a[1] - cutY) <= 1e-6 &&
				Math.abs(edge.b[1] - cutY) <= 1e-6
		)
		.map((edge) => ({
			a: [edge.a[0], edge.a[2]] as PlanPoint,
			b: [edge.b[0], edge.b[2]] as PlanPoint,
			kind: 'wall' as const,
			owner: source.identity
		}));
}

function capBoundarySegments(component: CutawayComponent): BoundarySegment[] {
	const { u, v, origin } = component.basis;
	const world = (point: readonly [number, number]): PlanPoint => [
		origin[0] + u[0] * point[0] + v[0] * point[1],
		origin[2] + u[2] * point[0] + v[2] * point[1]
	];
	return component.loops.flatMap((loop) =>
		loop.points.map((point, index) => ({
			a: world(point),
			b: world(loop.points[(index + 1) % loop.points.length]!),
			kind: 'cap' as const,
			owner: component.group
		}))
	);
}

function closingSeamSegments(component: CutawayComponent, cutY: number): BoundarySegment[] {
	return component.seams
		.filter((seam) => seam.closesStub && seam.topY > cutY + 1e-9)
		.map((seam) => ({
			a: seam.from,
			b: seam.to,
			kind: 'seam' as const,
			owner: seam.identity
		}));
}

function onSegment(point: PlanPoint, segment: BoundarySegment): boolean {
	const dx = segment.b[0] - segment.a[0];
	const dz = segment.b[1] - segment.a[1];
	const lengthSquared = dx * dx + dz * dz;
	if (!(lengthSquared > 1e-18)) {
		return Math.hypot(point[0] - segment.a[0], point[1] - segment.a[1]) <= WELD_TOLERANCE;
	}
	const t = ((point[0] - segment.a[0]) * dx + (point[1] - segment.a[1]) * dz) / lengthSquared;
	if (t < -1e-6 || t > 1 + 1e-6) return false;
	const distance = Math.abs(dx * (point[1] - segment.a[1]) - dz * (point[0] - segment.a[0])) / Math.sqrt(lengthSquared);
	return distance <= WELD_TOLERANCE;
}

/**
 * Split every segment at every welded endpoint lying in its interior (a
 * T-vertex), then count how many source segments cover each elementary
 * segment's midpoint. Collinear subdivisions therefore contribute exactly one
 * cover per input segment, never a coincident-edge false positive.
 */
function weldedBoundaryFailures(segments: readonly BoundarySegment[]): string[] {
	const endpoints = new Map<string, PlanPoint>();
	for (const segment of segments) {
		endpoints.set(planKey(segment.a), segment.a);
		endpoints.set(planKey(segment.b), segment.b);
	}
	const split: BoundarySegment[] = [];
	for (const segment of segments) {
		const dx = segment.b[0] - segment.a[0];
		const dz = segment.b[1] - segment.a[1];
		const lengthSquared = dx * dx + dz * dz;
		if (!(lengthSquared > 1e-18)) {
			split.push(segment);
			continue;
		}
		const cuts: Array<{ t: number; point: PlanPoint }> = [];
		for (const point of endpoints.values()) {
			if (planKey(point) === planKey(segment.a) || planKey(point) === planKey(segment.b)) continue;
			const t = ((point[0] - segment.a[0]) * dx + (point[1] - segment.a[1]) * dz) / lengthSquared;
			if (!(t > 1e-7 && t < 1 - 1e-7)) continue;
			const px = segment.a[0] + dx * t;
			const pz = segment.a[1] + dz * t;
			if (Math.hypot(point[0] - px, point[1] - pz) > WELD_TOLERANCE) continue;
			cuts.push({ t, point });
		}
		cuts.sort((left, right) => left.t - right.t);
		const chain: PlanPoint[] = [segment.a, ...cuts.map((cut) => cut.point), segment.b];
		for (let index = 0; index + 1 < chain.length; index += 1) {
			if (planKey(chain[index]!) === planKey(chain[index + 1]!)) continue;
			split.push({ ...segment, a: chain[index]!, b: chain[index + 1]! });
		}
	}
	const failures: string[] = [];
	for (const segment of split) {
		const midpoint: PlanPoint = [
			(segment.a[0] + segment.b[0]) / 2,
			(segment.a[1] + segment.b[1]) / 2
		];
		const coverers = segments.filter((candidate) => onSegment(midpoint, candidate));
		if (coverers.length === 2) continue;
		const at = `(${midpoint[0].toFixed(4)}, ${midpoint[1].toFixed(4)})`;
		const edge = `${at} ${segment.kind}:${segment.owner} [${segment.a.map((value) => value.toFixed(4)).join(', ')}]→[${segment.b.map((value) => value.toFixed(4)).join(', ')}]`;
		failures.push(
			`${edge} is covered ${coverers.length}× (expected wall/cap or seam/cap): ${coverers.map((coverer) => `${coverer.kind}:${coverer.owner}`).join(', ') || 'nothing'}`
		);
	}
	return failures;
}

type WallSeed = {
	readonly id: string;
	readonly start: [string, LayoutVec2];
	readonly end: [string, LayoutVec2];
	readonly thickness?: number;
	readonly height?: number;
	readonly centerline?: LayoutWall['centerline'];
};

function scene(walls: WallSeed[]): LayoutDocumentWallFirst {
	const junctionById = new Map<string, LayoutVec2>();
	for (const wall of walls) {
		junctionById.set(wall.start[0], wall.start[1]);
		junctionById.set(wall.end[0], wall.end[1]);
	}
	return {
		units: 'meters',
		formatVersion: 9,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [...junctionById].map(([id, point]) => ({ id, point })),
		walls: walls.map(
			(wall): LayoutWall =>
				({
					id: wall.id,
					startJunctionId: wall.start[0],
					endJunctionId: wall.end[0],
					thickness: wall.thickness ?? 0.2,
					height: wall.height ?? 3,
					centerline: wall.centerline ?? { kind: 'line' }
				}) as LayoutWall
		),
		rooms: [],
		openings: [],
		objects: [],
		regions: []
	};
}

/** A canonical cubic chain through interior bend points, as the write path builds it. */
function curve(wallId: string, start: LayoutVec2, end: LayoutVec2, ...interior: LayoutVec2[]): LayoutWall['centerline'] {
	const points: LayoutVec2[] = [start, ...interior, end];
	const knots: LayoutWallCurveKnot[] = interior.map((point, index) => ({
		id: `${wallId}:knot:${index + 1}`,
		point: [point[0], point[1]] as LayoutVec2
	}));
	return wallCubicChain(knots, deriveChainSpans(points));
}

type Fixture = { readonly name: string; readonly document: LayoutDocumentWallFirst };

const fixtures: Fixture[] = [
	{
		name: 'tangent continuation',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [4, 0]] }
		])
	},
	{
		name: 'L junction',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [0, 4]] }
		])
	},
	{
		name: 'T junction',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['b', [4, 0]], end: ['j', [0, 0]] },
			{ id: 'w3', start: ['j', [0, 0]], end: ['c', [0, 4]] }
		])
	},
	{
		name: 'X junction',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{ id: 'w2', start: ['b', [4, 0]], end: ['j', [0, 0]] },
			{ id: 'w3', start: ['c', [0, -4]], end: ['j', [0, 0]] },
			{ id: 'w4', start: ['j', [0, 0]], end: ['d', [0, 4]] }
		])
	},
	{
		name: 'thickness step',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]], thickness: 0.2 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [4, 0]], thickness: 0.4 }
		])
	},
	{
		name: 'height step',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]], height: 3 },
			{ id: 'w2', start: ['j', [0, 0]], end: ['b', [4, 0]], height: 2.4 }
		])
	},
	{
		name: 'curved leg',
		document: scene([
			{ id: 'w1', start: ['a', [-4, 0]], end: ['j', [0, 0]] },
			{
				id: 'w2',
				start: ['j', [0, 0]],
				end: ['b', [4, 0]],
				centerline: curve('w2', [0, 0], [4, 0], [2, 1])
			}
		])
	}
];

const STUB_TOP_Y = 1;

function subsets(ids: readonly string[]): string[][] {
	const out: string[][] = [];
	for (let mask = 1; mask < 1 << ids.length; mask += 1) {
		out.push(ids.filter((_, index) => (mask & (1 << index)) !== 0));
	}
	return out;
}

describe('X2 cap/seam catalogue', () => {
	for (const fixture of fixtures) {
		it(`${fixture.name}: every cut assignment welds its cut plane closed`, () => {
			const compilation = compileWallFirstLayoutGeometry(fixture.document);
			const blocking = compilation.issues.filter((issue) => issue.severity !== 'warning');
			expect(blocking).toEqual([]);
			const geometry = compilation.geometry;
			const ends = legJoinsByWall(geometry.junctions);
			const sources: WeldedSource[] = geometry.walls.map((wall) => {
				const built = buildStandaloneWallMesh(wall, 0, ends.get(wall.wallId) ?? { start: null, end: null });
				expect(built.issues).toEqual([]);
				expect(built.mesh).toBeDefined();
				return {
					identity: `wall:${wall.wallId}`,
					positions: built.mesh!.positions,
					index: built.mesh!.indices
				};
			});
			const sourceByWall = new Map(geometry.walls.map((wall, index) => [wall.wallId, sources[index]!]));
			const ids = geometry.walls.map((wall) => wall.wallId);
			if (fixture.name === 'curved leg') {
				// The fixture must exercise a sampled cubic, not silently compile as a line.
				expect(geometry.walls.find((wall) => wall.wallId === 'w2')!.samples.length).toBeGreaterThan(2);
			}

			for (const cutIds of subsets(ids)) {
				const assembly = assembleCutawayCaps({
					cut: new Set(cutIds),
					stubTopY: STUB_TOP_Y,
					junctions: geometry.junctions ?? [],
					walls: geometry.walls,
					floors: [{ floorId: 'floor-1', elevation: 0 }],
					sources
				});
				const label = `${fixture.name} cut={${cutIds.join(',')}}`;

				// A T/X where two legs at one Junction are both cut can leave a
				// partial-overlap collinear T-junction that `sectionMeshes` cannot net.
				// The retry keeps the trimmed branch (the near Wall) cut and closes the
				// core legs at that Junction to whole; only an untrimmed leg may be
				// dropped, never the branch and never an open stub.
				const trimmed = new Set(
					(geometry.junctions ?? []).flatMap((junction) =>
						junction.resolution.joins.filter((join) => (join.clipDistance ?? 0) > 0).map((join) => join.wallId)
					)
				);
				for (const wallId of assembly.failedWallIds) expect(trimmed.has(wallId), label).toBe(false);
				for (const wallId of cutIds) {
					if (trimmed.has(wallId)) {
						expect(
							assembly.components.some((component) => component.wallIds.includes(wallId)),
							`${label} keeps the cut branch ${wallId}`
						).toBe(true);
					}
				}
				expect(assembly.issues, label).toEqual([]);
				expect(assembly.components.length, label).toBeGreaterThan(0);

				for (const component of assembly.components) {
					expect(capFillsOf(component.loops).length, label).toBeGreaterThan(0);
					const segments: BoundarySegment[] = [
						...component.wallIds.flatMap((wallId) =>
							wallCutPlaneEdges(sourceByWall.get(wallId)!, STUB_TOP_Y)
						),
						...capBoundarySegments(component),
						...closingSeamSegments(component, STUB_TOP_Y)
					];
					const failures = weldedBoundaryFailures(segments);
					expect(
						failures,
						`${label} component ${component.group} walls={${component.wallIds.join(',')}} has ${failures.length} unwelded cut-plane edge(s):\n${failures.join('\n')}`
					).toEqual([]);
				}
			}
		});
	}
});

describe('welded cut-plane proof sensitivity', () => {
	const cap: BoundarySegment = { a: [0, 0], b: [1, 0], kind: 'cap', owner: 'component' };
	const wall: BoundarySegment = { a: [0, 0], b: [1, 0], kind: 'wall', owner: 'wall:w1' };

	it('accepts exactly the wall/cap pair', () => {
		expect(weldedBoundaryFailures([cap, wall])).toEqual([]);
	});

	it('rejects a cap edge with no closing surface', () => {
		const failures = weldedBoundaryFailures([cap]);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain('covered 1×');
		expect(failures[0]).toContain('cap:component');
	});

	it('rejects a duplicate closing surface', () => {
		const duplicate: BoundarySegment = { ...wall, kind: 'seam', owner: 'seam:duplicate' };
		const failures = weldedBoundaryFailures([cap, wall, duplicate]);
		expect(failures.length).toBeGreaterThan(0);
		expect(failures[0]).toContain('covered 3×');
		expect(failures[0]).toContain('seam:duplicate');
	});
});
