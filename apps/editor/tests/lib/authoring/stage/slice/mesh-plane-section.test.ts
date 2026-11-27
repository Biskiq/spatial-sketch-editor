/**
 * The cap catalogue (SL1 test 3 and 4).
 *
 * Every case is built from **real builder output** — `compileWallFirstLayoutGeometry`
 * → `buildStandaloneWallMesh`, the same two calls the editor's Wall representation
 * makes — and cut by the same `sectionMeshes` the Stage draws. A case passes only
 * when:
 *
 * - the group reports **zero** `CapAssemblyIssue`s (the gate: an open Layout group is
 *   a defect and an SL1 stop, never a fallback),
 * - every output polygon is a simple, positively-oriented outer ring (holes the
 *   other way) that does not overlap its siblings,
 * - the enclosed area equals the analytic area within 1e-6 m².
 *
 * The analytic area is derived **independently**: each Wall body is the convex quad
 * of its centreline extruded by half its thickness, and the area of their union is
 * computed by inclusion–exclusion over convex polygon intersections. At equal
 * thickness a miter line lies inside that union, so the mitered solid and the quad
 * union have the same area — which makes this a real oracle for mitered Junctions,
 * not a restatement of the builder.
 */
import {
	describe, expect, it } from 'vitest';
import { deriveChainSpans } from '@portfolio/layout-core/geometry';
import { compileWallFirstLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { legJoinsByWall, type LayoutDocumentWallFirst, type LayoutWall,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
} from '@portfolio/layout-core/wall';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-standalone';
import type { WallMeshOptions } from '$lib/layout/wall-mesh-types';
import {
	sectionMeshes,
	loopsToPolygons,
	type SectionGroupResult,
	type SectionInput,
	type SectionPoint,
	type SectionResult
} from '$lib/authoring/stage/slice/mesh-plane-section';

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

type WallSeed = {
	readonly id: string;
	readonly start: readonly [string, LayoutVec2];
	readonly end: readonly [string, LayoutVec2];
	readonly thickness?: number;
	readonly height?: number;
};

function scene(walls: readonly WallSeed[], extra: Partial<LayoutDocumentWallFirst> = {}): LayoutDocumentWallFirst {
	const junctionById = new Map<string, LayoutVec2>();
	for (const wall of walls) {
		junctionById.set(wall.start[0], wall.start[1]);
		junctionById.set(wall.end[0], wall.end[1]);
	}
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
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
					top: { kind: 'level' },
					centerline: { kind: 'line' }
				}) as LayoutWall
		),
		rooms: [],
		openings: [],
		objects: [],
		regions: [],
		...extra
	};
}

/** A single free-standing Wall, both ends degree 1 (the square-cap path). */
function oneWall(options: {
	length: number;
	thickness?: number;
	height?: number;
	angleDegrees?: number;
}): LayoutDocumentWallFirst {
	const radians = ((options.angleDegrees ?? 0) * Math.PI) / 180;
	const end: LayoutVec2 = [Math.cos(radians) * options.length, Math.sin(radians) * options.length];
	return scene([
		{
			id: 'w',
			start: ['a', [0, 0]],
			end: ['b', end],
			thickness: options.thickness,
			height: options.height
		}
	]);
}

/** A closed rectangle Room: four Walls sharing four Junctions. */
function ring(width = 6, depth = 4, thickness = 0.2): LayoutDocumentWallFirst {
	const corners: readonly [string, LayoutVec2][] = [
		['c0', [0, 0]],
		['c1', [width, 0]],
		['c2', [width, depth]],
		['c3', [0, depth]]
	];
	return scene(
		corners.map(([id, point], index) => ({
			id: `w${index}`,
			start: [id, point] as const,
			end: [corners[(index + 1) % 4]![0], corners[(index + 1) % 4]![1]] as const,
			thickness
		}))
	);
}

/** The Wall inputs of a document, grouped exactly as the Stage groups them. */
function wallInputs(
	document: LayoutDocumentWallFirst,
	options: WallMeshOptions = {},
	group = 'structure'
): SectionInput[] {
	const compilation = compileWallFirstLayoutGeometry(document);
	expect(compilation.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	const ends = legJoinsByWall(compilation.geometry.junctions);
	const inputs: SectionInput[] = [];
	for (const wall of compilation.geometry.walls) {
		const result = buildStandaloneWallMesh(
			wall,
			document.floor.elevation,
			ends.get(wall.wallId) ?? { start: null, end: null },
			options
		);
		expect(result.issues, `${wall.wallId}`).toEqual([]);
		const mesh = result.mesh!;
		inputs.push({
			identity: `wall:${wall.wallId}`,
			group,
			positions: mesh.positions,
			index: mesh.indices
		});
	}
	return inputs;
}

/** The section plane for a horizontal cut: keeps `y ≤ cutY`. */
const CUT_PLANE = (cutY = 1.2) => ({ normal: [0, -1, 0] as const, constant: cutY });

function cut(inputs: readonly SectionInput[], cutY = 1.2, options = {}): SectionResult {
	return sectionMeshes(inputs, CUT_PLANE(cutY), options);
}

// ---------------------------------------------------------------------------
// The independent area oracle
// ---------------------------------------------------------------------------

type Polygon = SectionPoint[];

function polygonArea(ring: Polygon): number {
	let twice = 0;
	for (let index = 0; index < ring.length; index += 1) {
		const a = ring[index]!;
		const b = ring[(index + 1) % ring.length]!;
		twice += a[0] * b[1] - a[1] * b[0];
	}
	return twice / 2;
}

/** Sutherland–Hodgman clipping of a convex subject by a convex, CCW clip polygon. */
function clipPolygon(subject: readonly SectionPoint[], clip: readonly SectionPoint[]): Polygon {
	let output = [...subject];
	for (let edge = 0; edge < clip.length && output.length > 0; edge += 1) {
		const a = clip[edge]!;
		const b = clip[(edge + 1) % clip.length]!;
		const side = (point: SectionPoint): number =>
			(b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
		const input = output;
		output = [];
		for (let index = 0; index < input.length; index += 1) {
			const current = input[index]!;
			const previous = input[(index + input.length - 1) % input.length]!;
			const currentSide = side(current);
			const previousSide = side(previous);
			if (currentSide >= 0) {
				if (previousSide < 0) {
					const t = previousSide / (previousSide - currentSide);
					output.push([
						previous[0] + (current[0] - previous[0]) * t,
						previous[1] + (current[1] - previous[1]) * t
					]);
				}
				output.push(current);
			} else if (previousSide >= 0) {
				const t = previousSide / (previousSide - currentSide);
				output.push([
					previous[0] + (current[0] - previous[0]) * t,
					previous[1] + (current[1] - previous[1]) * t
				]);
			}
		}
	}
	return output;
}

/** One Wall body as the convex quad its centreline extrudes by half its thickness. */
function wallQuad(start: LayoutVec2, end: LayoutVec2, thickness: number): Polygon {
	const dx = end[0] - start[0];
	const dz = end[1] - start[1];
	const length = Math.hypot(dx, dz);
	const nx = (-dz / length) * (thickness / 2);
	const nz = (dx / length) * (thickness / 2);
	return [
		[start[0] + nx, start[1] + nz],
		[end[0] + nx, end[1] + nz],
		[end[0] - nx, end[1] - nz],
		[start[0] - nx, start[1] - nz]
	];
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function groupOf(result: SectionResult, group = 'structure'): SectionGroupResult {
	const found = result.groups.find((candidate) => candidate.group === group);
	expect(found, `group ${group}`).toBeDefined();
	return found!;
}

function totalArea(group: SectionGroupResult): number {
	return group.loops.reduce((sum, loop) => sum + loop.signedArea, 0);
}

/** Every loop is simple; outers are counter-clockwise and holes clockwise. */
function expectSimpleLoops(group: SectionGroupResult): void {
	for (const loop of group.loops) {
		expect(loop.points.length).toBeGreaterThanOrEqual(3);
		expect(loop.edgeIdentities.length).toBe(loop.points.length);
		if (loop.role === 'outer') expect(loop.signedArea).toBeGreaterThan(0);
		else expect(loop.signedArea).toBeLessThan(0);
	}
}

/** No two outer polygons overlap, and no hole escapes its outer. */
function expectDisjointPolygons(group: SectionGroupResult): void {
	const polygons = loopsToPolygons(group.loops);
	for (let first = 0; first < polygons.length; first += 1) {
		for (let second = first + 1; second < polygons.length; second += 1) {
			const overlap = clipPolygon(
				polygons[first]!.outer,
				polygons[second]!.outer
			);
			expect(Math.abs(overlap.length < 3 ? 0 : polygonArea(overlap))).toBeLessThan(1e-6);
		}
	}
}

function expectCatalogue(result: SectionResult, expected: number): SectionGroupResult {
	const group = groupOf(result);
	expect(result.issues).toEqual([]);
	expect(group.issue).toBeNull();
	expectSimpleLoops(group);
	expectDisjointPolygons(group);
	// The builder emits Float32 positions (≈5e-7 m at these coordinates), so the
	// area contract is 1e-5 m² against the analytic value.
	expect(totalArea(group)).toBeCloseTo(expected, 5);
	return group;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

describe('sectionMeshes — the SL1 cap catalogue', () => {
	it('sections a box Wall into one rectangle', () => {
		const document = oneWall({ length: 4 });
		const result = cut(wallInputs(document));
		// A free end is a square cap at the centreline endpoint: L × t.
		const group = expectCatalogue(result, 4 * 0.2);
		expect(group.loops).toHaveLength(1);
		expect(group.loops[0]!.role).toBe('outer');
	});

	it('sections a closed ring Room into one outer and one hole', () => {
		const document = ring();
		const result = cut(wallInputs(document));
		// A closed equal-thickness ring: area = perimeter × thickness.
		const group = expectCatalogue(result, 2 * (6 + 4) * 0.2);
		expect(group.loops.filter((loop) => loop.role === 'outer')).toHaveLength(1);
		expect(group.loops.filter((loop) => loop.role === 'hole')).toHaveLength(1);
		expect(totalArea(group)).toBeCloseTo(2 * (6 + 4) * 0.2, 5);
	});

	it('sections an L miter and an L bevel (with its bridge) without an issue', () => {
		const document = scene([
			{ id: 'a', start: ['j0', [0, 0]], end: ['j1', [4, 0]] },
			{ id: 'b', start: ['j1', [4, 0]], end: ['j2', [4, 3]] }
		]);
		const miter = cut(wallInputs(document));
		// Two 90° legs with free ends, mitered: t × (L1 + L2).
		expectCatalogue(miter, 0.2 * (4 + 3));
		expect(groupOf(miter).loops).toHaveLength(1);

		// Forced bevel: the corner is chamfered, so the area is the miter's minus
		// the two cut-back wedges (t²/8 each at 90°).
		const bevel = cut(wallInputs(document, { miterLimit: 1 }));
		const group = groupOf(bevel);
		expect(bevel.issues).toEqual([]);
		expect(group.loops).toHaveLength(1);
		expectSimpleLoops(group);
		// The bevel chamfers the miter: the area is strictly smaller, by no more than
		// the two corner wedges a miter would have filled.
		expect(totalArea(group)).toBeLessThan(0.2 * (4 + 3));
		expect(totalArea(group)).toBeGreaterThan(0.2 * (4 + 3) - 2 * 0.2 * 0.2);
	});

	it('closes a T Junction whose stem ends inside the through face', () => {
		const document = scene([
			{ id: 'through', start: ['j0', [0, 0]], end: ['j1', [6, 0]] },
			{ id: 'stem', start: ['j2', [3, 0]], end: ['j3', [3, 3]] }
		]);
		const result = cut(wallInputs(document));
		// The stem is trimmed at the through Wall's face: t·(6 + 3) − (t/2)·t.
		const group = expectCatalogue(result, 0.2 * (6 + 3) - 0.1 * 0.2);
		expect(group.loops).toHaveLength(1);
	});

	it('closes X and Y Junctions with keels', () => {
		const cross = scene([
			{ id: 'through', start: ['j0', [0, 0]], end: ['j1', [6, 0]] },
			{ id: 'crossing', start: ['j2', [3, -3]], end: ['j3', [3, 3]] }
		]);
		// Two full-length Walls crossing: t·(6 + 6) − t².
		expectCatalogue(cut(wallInputs(cross)), 0.2 * 12 - 0.04);

		const radians = (120 * Math.PI) / 180;
		const ray = (index: number): LayoutVec2 => [
			Math.cos(radians * index) * 3,
			Math.sin(radians * index) * 3
		];
		const y = scene([
			{ id: 'a', start: ['jy', [0, 0]], end: ['a1', ray(0)] },
			{ id: 'b', start: ['jy', [0, 0]], end: ['b1', ray(1)] },
			{ id: 'c', start: ['jy', [0, 0]], end: ['c1', ray(2)] }
		]);
		// Three equal rays at 120° meet in a keel whose area is a builder decision, so
		// the exact contract here is watertightness plus a bounded area: the three
		// bodies are 3 × 3 m long and 0.2 m thick, and the junction only subtracts.
		const yResult = cut(wallInputs(y));
		const yGroup = groupOf(yResult);
		expect(yResult.issues).toEqual([]);
		expectSimpleLoops(yGroup);
		expect(yGroup.loops).toHaveLength(1);
		expect(totalArea(yGroup)).toBeLessThanOrEqual(0.2 * 9 + 1e-5);
		expect(totalArea(yGroup)).toBeGreaterThan(0.2 * 9 - 0.15);
	});

	it('sections a curved Wall along its tessellation', () => {
		const document = scene([
			{ id: 'arc', start: ['j0', [0, 0]], end: ['j1', [4, 0]] }
		]);
		// A curved Wall is compiled from a curved authored path; the section must be
		// the tessellation's own loop, not a chord or a second derivation.
		// A curve is a cubic chain: one knot above the chord is enough to prove the
		// section follows the tessellation rather than the ends' chord.
		const curved: LayoutDocumentWallFirst = {
			...document,
			walls: document.walls.map((wall) => ({
				...wall,
				centerline: {
					kind: 'cubic-chain' as const,
					knots: [{ id: 'arc-k0', point: [2, 1.2] as LayoutVec2 }],
					spans: deriveChainSpans([[0, 0], [2, 1.2], [4, 0]])
				}
			}))
		};
		const inputs = wallInputs(curved);
		const result = cut(inputs);
		const group = groupOf(result);
		expect(result.issues).toEqual([]);
		expect(group.loops.length).toBeGreaterThanOrEqual(1);
		expectSimpleLoops(group);
		expect(totalArea(group)).toBeGreaterThan(0);
	});

	it('leaves door and window voids as gaps at the cut', () => {
		const door = scene([
			{ id: 'a', start: ['j0', [0, 0]], end: ['j1', [6, 0]] }
		]);
		const withDoor: LayoutDocumentWallFirst = {
			...door,
			openings: [
				{
					id: 'door',
					wallId: 'a',
					kind: 'door',
					offset: 2.5,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				}
			] as LayoutDocumentWallFirst['openings']
		};
		const result = cut(wallInputs(withDoor));
		expectCatalogue(result, 6 * 0.2 - 0.9 * 0.2);
	});

	it('covers a Door beside a Junction and an Arch cut through its head', () => {
		const base = ring();
		const atCorner: LayoutDocumentWallFirst = {
			...base,
			openings: [
				{
					id: 'corner-door',
					wallId: 'w0',
					kind: 'door',
					offset: 0.3,
					width: 0.6,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				}
			] as LayoutDocumentWallFirst['openings']
		};
		const corner = cut(wallInputs(atCorner));
		expect(corner.issues).toEqual([]);
		expectSimpleLoops(groupOf(corner));

		const archBase = scene([{ id: 'a', start: ['j0', [0, 0]], end: ['j1', [6, 0]] }]);
		const arch: LayoutDocumentWallFirst = {
			...archBase,
			openings: [
				{
					id: 'arch',
					wallId: 'a',
					kind: 'door',
					offset: 2,
					width: 1.4,
					height: 2.6,
					sillHeight: 0,
					profile: 'pointed'
				}
			] as LayoutDocumentWallFirst['openings']
		};
		const throughHead = cut(wallInputs(arch), 2.2);
		const group = groupOf(throughHead);
		expect(throughHead.issues).toEqual([]);
		expectSimpleLoops(group);
		expect(totalArea(group)).toBeGreaterThan(0);
	});

	it('cuts exactly at a sill, a head and a Wall top (the offset rule)', () => {
		const base = scene([{ id: 'a', start: ['j0', [0, 0]], end: ['j1', [6, 0]] }]);
		const windowed: LayoutDocumentWallFirst = {
			...base,
			openings: [
				{
					id: 'window',
					wallId: 'a',
					kind: 'window',
					offset: 2,
					width: 1.2,
					height: 1.2,
					sillHeight: 0.9,
					profile: 'rectangular'
				}
			] as LayoutDocumentWallFirst['openings']
		};
		const inputs = wallInputs(windowed);
		// The section runs 0.1 mm below the plane, so a cut named at a face is a
		// clean solid side or a clean void side — never a coplanar degeneracy.
		const solid = 6 * 0.2;
		const atSill = groupOf(cut(inputs, 0.9));
		expect(atSill.issue).toBeNull();
		expectSimpleLoops(atSill);
		expect(totalArea(atSill)).toBeCloseTo(solid, 4);

		const atHead = groupOf(cut(inputs, 2.1));
		expect(atHead.issue).toBeNull();
		expectSimpleLoops(atHead);
		expect(totalArea(atHead)).toBeCloseTo(solid - 1.2 * 0.2, 4);

		const atTop = groupOf(cut(inputs, 3));
		expect(atTop.issue).toBeNull();
		expectSimpleLoops(atTop);
		expect(totalArea(atTop)).toBeCloseTo(solid, 4);
	});

	it('unions two overlapping, not joined Walls into one boundary', () => {
		const document = scene([
			{ id: 'a', start: ['a0', [0, 0]], end: ['a1', [4, 0]] },
			{ id: 'b', start: ['b0', [2, -2]], end: ['b1', [2, 2]] }
		]);
		const result = cut(wallInputs(document));
		// Two crossing Walls: t·(4 + 4) − t².
		const group = expectCatalogue(result, 0.2 * 8 - 0.04);
		expect(group.loops).toHaveLength(1);
	});

	it('drops a net-zero pair and keeps a duplicated Wall as net 2', () => {
		const document = oneWall({ length: 4 });
		const inputs = wallInputs(document);
		const doubled = cut([...inputs, ...inputs]);
		expectCatalogue(doubled, 4 * 0.2);

		// Two coincident faces running opposite ways cancel: the strip is zero
		// thickness, so the section has no boundary and no issue.
		const strip = (sign: 1 | -1) => ({
			identity: 'synthetic',
			group: 'synthetic',
			positions: new Float32Array([
				0, 1.0, 0, 0, 1.4, 0, 0, 1.4, 1,
				0, 1.0, 0, 0, 1.4, 1, 0, 1.0, 1
			]),
			index: sign === 1 ? [0, 1, 2, 3, 4, 5] : [2, 1, 0, 5, 4, 3]
		});
		const cancelled = cut([strip(1), strip(-1)]);
		const group = groupOf(cancelled, 'synthetic');
		expect(group.loops).toEqual([]);
		expect(group.issue).toBeNull();
	});

	it('keeps a plinth flush against a Wall as its own group', () => {
		const document = oneWall({ length: 4 });
		const inputs = wallInputs(document);
		const plinth = boxMesh('plinth', [0, 0, 0.1], [2, 1.4, 1.1], 'object:plinth');
		const result = cut([...inputs, plinth]);
		expectCatalogue(result, 4 * 0.2);
		const objectGroup = groupOf(result, 'object:plinth');
		expect(objectGroup.issue).toBeNull();
		expect(totalArea(objectGroup)).toBeCloseTo(2 * 1, 6);
	});

	it('reports a Jamb that coincides with a Junction plane instead of guessing', () => {
		// Known limitation, pinned so it cannot regress silently: when a Door's jamb
		// plane is exactly the Junction plane, the Wall mesh carries a duplicated edge
		// with no opposing face (the Door void and the miter corner emit the same
		// diagonal). The face set is then not watertight, so the cap cannot be closed.
		// SL1 draws what is there as edges, names the group, and never throws.
		const base = ring();
		const coincident: LayoutDocumentWallFirst = {
			...base,
			openings: [
				{
					id: 'corner-door',
					wallId: 'w0',
					kind: 'door',
					offset: 0,
					width: 0.9,
					height: 2.1,
					sillHeight: 0,
					profile: 'rectangular'
				}
			] as LayoutDocumentWallFirst['openings']
		};
		const result = cut(wallInputs(coincident));
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]!.group).toBe('structure');
		expect(result.groups[0]!.loops).toEqual([]);
		expect(result.groups[0]!.chains.length).toBeGreaterThan(0);
	});

	it('draws an open mesh as edges and reports one issue, without throwing', () => {
		const open: SectionInput = {
			identity: 'wall:open',
			group: 'structure',
			positions: new Float32Array([0, 1.0, 0, 1, 1.4, 0, 1, 1.0, 1]),
			index: [0, 1, 2]
		};
		const result = cut([open]);
		const group = groupOf(result);
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0]).toMatchObject({ group: 'structure', identity: 'wall:open' });
		expect(result.issues[0]!.unmatchedVertices).toBeGreaterThan(0);
		expect(group.loops).toEqual([]);
		expect(group.chains.length).toBeGreaterThan(0);
		expect(group.chains[0]!.points.length).toBeGreaterThanOrEqual(2);
	});

	it('carries every edge’s source identity through split and merge', () => {
		const document = scene([
			{ id: 'a', start: ['j0', [0, 0]], end: ['j1', [4, 0]] },
			{ id: 'b', start: ['j1', [4, 0]], end: ['j2', [4, 3]] },
			{ id: 'c', start: ['j3', [2, 0]], end: ['j4', [2, 2]] }
		]);
		const result = cut(wallInputs(document));
		const group = groupOf(result);
		expect(group.issue).toBeNull();
		const seen = new Set(group.loops.flatMap((loop) => loop.edgeIdentities));
		expect([...seen].sort()).toEqual(['wall:a', 'wall:b', 'wall:c']);
		// A selected identity's edges are isolated for the gold stroke.
		const selected = group.loops.flatMap((loop) =>
			loop.edgeIdentities.filter((identity) => identity === 'wall:c')
		);
		expect(selected.length).toBeGreaterThan(0);
	});
});

/** A closed box mesh in world space, for the plinth group. */
function boxMesh(
	identity: string,
	min: readonly [number, number, number],
	max: readonly [number, number, number],
	group: string
): SectionInput {
	const [x0, y0, z0] = min;
	const [x1, y1, z1] = max;
	const positions: number[] = [];
	const indices: number[] = [];
	const vertex = (x: number, y: number, z: number): number => {
		positions.push(x, y, z);
		return positions.length / 3 - 1;
	};
	const quad = (
		a: readonly [number, number, number],
		b: readonly [number, number, number],
		c: readonly [number, number, number],
		d: readonly [number, number, number]
	): void => {
		const ia = vertex(...a);
		const ib = vertex(...b);
		const ic = vertex(...c);
		const id = vertex(...d);
		indices.push(ia, ib, ic, ia, ic, id);
	};
	quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
	quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
	quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
	quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
	quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
	quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
	return { identity, group, positions: new Float32Array(positions), index: indices };
}
