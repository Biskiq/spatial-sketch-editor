/**
 * The emitted physical Walls of a Layout close into a solid.
 *
 * A Wall sharing a Junction is not closed alone: the corner plane is interior to
 * the union, so closure is asserted on the union of the Walls' meshes. A T-vertex
 * along a shared line is still closed, so every edge is first split at the vertices
 * lying on it. A branch that abuts a through Wall's face is sealed by that face,
 * which the fixtures that have one declare as `abutting`.
 */
import {
	describe, expect, it } from 'vitest';
import { compileWallFirstLayoutGeometry, type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { legJoinsByWall, type LayoutDocumentWallFirst, type LayoutWall,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
} from '@portfolio/layout-core/wall';
import { assertWindingAgreesWithNormals } from '$lib/layout/wall-mesh-emit';
import { compileRoom } from '../../helpers/wall-mesh-fixtures';
import { buildRoomWallMesh } from '$lib/layout/wall-mesh-room';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-standalone';
import type { IndexedWallMesh } from '$lib/layout/wall-mesh-types';

type V3 = [number, number, number];

function wall(id: string, a: string, b: string, overrides: Partial<LayoutWall> = {}): LayoutWall {
	return { id, startJunctionId: a, endJunctionId: b, thickness: 0.2, height: 3, top: { kind: 'level' }, centerline: { kind: 'line' }, ...overrides } as LayoutWall;
}

function layout(
	points: Record<string, LayoutVec2>,
	walls: LayoutWall[],
	openings: unknown[] = []
): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: Object.entries(points).map(([id, point]) => ({ id, point })),
		walls,
		rooms: [],
		openings,
		objects: [],
		regions: []
	} as unknown as LayoutDocumentWallFirst;
}

function meshes(document: LayoutDocumentWallFirst): IndexedWallMesh[] {
	const compiled = compileWallFirstLayoutGeometry(document);
	expect(compiled.issues ?? []).toEqual([]);
	const joins = legJoinsByWall(compiled.geometry.junctions);
	return compiled.geometry.walls.map((compiledWall) => {
		const built = buildStandaloneWallMesh(compiledWall, 0, joins.get(compiledWall.wallId) ?? null);
		expect(built.issues).toEqual([]);
		assertWindingAgreesWithNormals(built.mesh!);
		return built.mesh!;
	});
}

function triangles(all: readonly IndexedWallMesh[]): V3[][] {
	const out: V3[][] = [];
	for (const mesh of all) {
		const point = (index: number): V3 => [mesh.positions[index * 3]!, mesh.positions[index * 3 + 1]!, mesh.positions[index * 3 + 2]!];
		for (let t = 0; t < mesh.indices.length; t += 3) {
			out.push([point(mesh.indices[t]!), point(mesh.indices[t + 1]!), point(mesh.indices[t + 2]!)]);
		}
	}
	return out;
}

const GRID = 1e-5;
const keyOf = (p: V3): string => p.map((value) => Math.round(value / GRID)).join(',');

/** Directed edges left unmatched once every edge is split at the vertices on it. */
function openEdges(tris: readonly V3[][]): Array<[V3, V3]> {
	const vertices = new Map<string, V3>();
	for (const tri of tris) for (const p of tri) vertices.set(keyOf(p), p);
	const all = [...vertices.values()];
	const balance = new Map<string, { net: number; a: V3; b: V3 }>();
	for (const tri of tris) {
		for (let e = 0; e < 3; e += 1) {
			const a = tri[e]!;
			const b = tri[(e + 1) % 3]!;
			const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const lengthSq = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
			if (lengthSq < GRID ** 2) continue;
			const along = all
				.map((p) => {
					const v: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
					const t = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / lengthSq;
					const off = Math.hypot(v[0] - t * d[0], v[1] - t * d[1], v[2] - t * d[2]);
					return { p, t, off };
				})
				.filter((entry) => entry.off < 2 * GRID && entry.t > -1e-9 && entry.t < 1 + 1e-9)
				.sort((x, y) => x.t - y.t);
			for (let i = 1; i < along.length; i += 1) {
				const from = along[i - 1]!.p;
				const to = along[i]!.p;
				const ka = keyOf(from);
				const kb = keyOf(to);
				if (ka === kb) continue;
				const forward = ka < kb;
				const key = forward ? `${ka}|${kb}` : `${kb}|${ka}`;
				const entry = balance.get(key) ?? { net: 0, a: forward ? from : to, b: forward ? to : from };
				entry.net += forward ? 1 : -1;
				balance.set(key, entry);
			}
		}
	}
	return [...balance.values()].filter((entry) => entry.net !== 0).map((entry) => [entry.a, entry.b]);
}

/** ∮ n dA: zero for any closed surface, whatever its triangulation. */
function vectorArea(tris: readonly V3[][]): number {
	const sum: V3 = [0, 0, 0];
	for (const [a, b, c] of tris as [V3, V3, V3][]) {
		const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
		sum[0] += (u[1] * v[2] - u[2] * v[1]) / 2;
		sum[1] += (u[2] * v[0] - u[0] * v[2]) / 2;
		sum[2] += (u[0] * v[1] - u[1] * v[0]) / 2;
	}
	return Math.hypot(...sum);
}

function signedVolume(tris: readonly V3[][]): number {
	let total = 0;
	for (const [a, b, c] of tris as [V3, V3, V3][]) {
		total += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
	}
	return total;
}

const square = { a: [0, 0], b: [5, 0], c: [5, 4], d: [0, 4] } satisfies Record<string, LayoutVec2>;
const rectangle = (bc: Partial<LayoutWall> = {}) => [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', bc), wall('w3', 'c', 'd'), wall('w4', 'd', 'a')];

const CLOSED: Array<[string, LayoutDocumentWallFirst]> = [
	['single Wall', layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')])],
	['single Wall at an angle', layout({ a: [1, 2], b: [4, 6] }, [wall('w1', 'a', 'b')])],
	['L corner', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
	['reversed L corner', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'b', 'a'), wall('w2', 'b', 'c')])],
	['L corner, heights differ', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { height: 2 })])],
	['L corner, heights differ the other way', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b', { height: 2 }), wall('w2', 'b', 'c')])],
	['closed rectangle', layout(square, rectangle())],
	['closed rectangle, one lower Wall', layout(square, rectangle({ height: 2 }))],
	['closed rectangle, one thicker Wall', layout(square, rectangle({ thickness: 0.4 }))],
	['straight continuation, heights differ', layout({ a: [0, 0], b: [3, 0], c: [6, 0] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { height: 2 })])],
	['straight continuation, thicknesses differ', layout({ a: [0, 0], b: [3, 0], c: [6, 0] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { thickness: 0.4 })])],
	['60° corner', layout({ a: [0, 0], b: [5, 0], c: [3, 3.46] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
	['45° corner', layout({ a: [0, 0], b: [5, 0], c: [2, 3] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
	['45° corner, heights differ', layout({ a: [0, 0], b: [5, 0], c: [2, 3] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c', { height: 2 })])],
	['reversed corner, heights differ', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'b', 'a', { height: 2 }), wall('w2', 'b', 'c')])],
	['both ends at the corner', layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b'), wall('w2', 'c', 'b')])],
	['120° corner', layout({ a: [0, 0], b: [5, 0], c: [7, 3.46] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')])],
];

describe('physical Wall solids', () => {
	it.each(CLOSED)('%s is closed', (_name, document) => {
		const tris = triangles(meshes(document));
		expect(openEdges(tris)).toEqual([]);
		expect(vectorArea(tris)).toBeLessThan(1e-6);
	});

	it('a single Wall has its exact volume and an outward face on each end', () => {
		const [mesh] = meshes(layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')]));
		const tris = triangles([mesh!]);
		expect(Math.abs(signedVolume(tris))).toBeCloseTo(5 * 0.2 * 3, 6);
		for (const [x, sign] of [[0, -1], [5, 1]] as const) {
			const end = tris.filter((tri) => tri.every((p) => Math.abs(p[0] - x) < 1e-6));
			expect(end).toHaveLength(2);
			for (const [a, b, c] of end as [V3, V3, V3][]) {
				const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
				expect(Math.sign(nx)).toBe(sign);
			}
		}
	});

	it('an end Opening stays a void, and the Wall stays closed around it', () => {
		const document = layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')], [
			{ id: 'o1', wallId: 'w1', kind: 'door', offset: 0, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' }
		]);
		const compiled = compileWallFirstLayoutGeometry(document);
		const joins = legJoinsByWall(compiled.geometry.junctions).get('w1')!;
		const cap = joins.start!.surfaces!.filter((surface) => surface.kind === 'terminal-cap');
		expect(cap.flatMap((surface) => surface.bands)).toEqual([{ bottomY: 2, topY: 3 }]);
		const tris = triangles(meshes(document));
		expect(openEdges(tris)).toEqual([]);
	});

	it('a mid-Wall Opening keeps the Wall closed, with the cap welded to the side bands', () => {
		const tris = triangles(
			meshes(
				layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')], [
					{ id: 'o1', wallId: 'w1', kind: 'window', offset: 2, width: 1, height: 1, sillHeight: 1, profile: 'rectangular' }
				])
			)
		);
		expect(openEdges(tris)).toEqual([]);
		expect(vectorArea(tris)).toBeLessThan(1e-6);
	});

	it.each([
		['T junction', {}],
		['T junction, taller branch', { height: 4 }]
	] as Array<[string, Partial<LayoutWall>]>)('%s only stays open where the branch abuts the through Wall', (_name, branch) => {
		const tris = triangles(
			meshes(layout({ a: [-3, 0], b: [0, 0], c: [3, 0], d: [0, 3] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c'), wall('w3', 'b', 'd', branch)]))
		);
		for (const [a, b] of openEdges(tris)) {
			// The through Wall's face is z = ±0.1 here; a surviving edge lies on it.
			expect(Math.abs(a[2])).toBeCloseTo(0.1, 6);
			expect(Math.abs(b[2])).toBeCloseTo(0.1, 6);
		}
	});

	/**
 * T1 V2a · T-P3 — a profiled top does not open a Junction.
 *
 * A Junction leg carries its Wall's own end top, and the section ring at that
 * end reads the same value, so a mitre (degree 2) and a branch sealed by the
 * through Wall's face (degree 3) close exactly as their level counterparts do.
 * A step between the two end tops is the existing "heights differ" case; a slope
 * only moves where that step begins. Degree 4 is proven with the landed C2
 * Junction matrix harness (`junction-matrix.test.ts`), whose union contract is
 * `assertUnionManifoldWithBoundary`, not the closed-solid oracle below: the two
 * crossing through Walls leave an internal boundary on `main` too.
 */
	describe('V2a profiled Wall solids', () => {
		const slope = (startRise: number, endRise: number) => ({ kind: 'slope' as const, startRise, endRise });
		const gable = (apexRise = 2) => ({ kind: 'gable' as const, startRise: 0, endRise: 0, apexRise, apexOffset: 2.5 });
		const door = { id: 'o1', wallId: 'w1', kind: 'door', offset: 0, width: 1, height: 2, sillHeight: 0, profile: 'rectangular' };

		const CASES: Array<[string, LayoutDocumentWallFirst]> = [
			[
				'L corner, slope meets level',
				layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [
					wall('w1', 'a', 'b', { top: slope(0, 2) }),
					wall('w2', 'b', 'c')
				])
			],
			[
				'L corner, slope meets a taller level Wall',
				layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [
					wall('w1', 'a', 'b', { top: slope(0, 1) }),
					wall('w2', 'b', 'c', { height: 5 })
				])
			],
			[
				'L corner, two slopes meet at one top',
				layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [
					wall('w1', 'a', 'b', { top: slope(0, 2) }),
					wall('w2', 'b', 'c', { top: slope(2, 0) })
				])
			],
			[
				'L corner, gable eave meets a level Wall',
				layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b', { top: gable() }), wall('w2', 'b', 'c')])
			],
			[
				'L corner, end door on the sloped Wall',
				layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b', { top: slope(0, 2) }), wall('w2', 'b', 'c')], [door])
			],
			[
				'closed rectangle, alternating slopes',
				layout(square, [
					wall('w1', 'a', 'b', { top: slope(0, 2) }),
					wall('w2', 'b', 'c', { top: slope(2, 0) }),
					wall('w3', 'c', 'd', { top: slope(0, 2) }),
					wall('w4', 'd', 'a', { top: slope(2, 0) })
				])
			],
			[
				'closed rectangle, gable and level Walls',
				layout(square, [wall('w1', 'a', 'b', { top: gable() }), wall('w2', 'b', 'c'), wall('w3', 'c', 'd', { top: slope(0, 1) }), wall('w4', 'd', 'a')])
			],
		];

		it.each(CASES)('%s is closed', (_name, document) => {
			const all = meshes(document);
			for (const mesh of all) assertWindingAgreesWithNormals(mesh);
			const tris = triangles(all);
			expect(openEdges(tris)).toEqual([]);
			expect(vectorArea(tris)).toBeLessThan(1e-6);
		});

		it('a T junction with a sloped branch only stays open where the branch abuts the through Wall', () => {
			const tris = triangles(
				meshes(
					layout({ a: [-3, 0], b: [0, 0], c: [3, 0], d: [0, 3] }, [
						wall('w1', 'a', 'b'),
						wall('w2', 'b', 'c'),
						wall('w3', 'b', 'd', { top: slope(0, 2) })
					])
				)
			);
			for (const [a, b] of openEdges(tris)) {
				expect(Math.abs(a[2])).toBeCloseTo(0.1, 6);
				expect(Math.abs(b[2])).toBeCloseTo(0.1, 6);
			}
		});

		it('a slope steps the mitre at the exact Junction end top', () => {
			const [sloped] = meshes(
				layout({ a: [0, 0], b: [5, 0], c: [5, 4] }, [wall('w1', 'a', 'b', { top: slope(0, 2) }), wall('w2', 'b', 'c')])
			);
			// The mitre's two end apexes: the inner corner at x = 4.9, the outer at 5.1.
			const atEnd: number[] = [];
			for (let index = 0; index < sloped!.positions.length / 3; index += 1) {
				const x = sloped!.positions[index * 3]!;
				if (Math.abs(x - 4.9) < 1e-6 || Math.abs(x - 5.1) < 1e-6) atEnd.push(sloped!.positions[index * 3 + 1]!);
			}
			// Without this the loop below is vacuous: the end face must exist.
			expect(atEnd.length).toBeGreaterThanOrEqual(4);
			// Every vertex on the end is on the floor, at the level neighbour's 3 m top, or at
			// the Wall's own end top, 5 m: the 3 -> 5 step is the existing heights-differ seam.
			for (const y of atEnd) expect([0, 3, 5].some((level) => Math.abs(y - level) < 1e-9)).toBe(true);
			expect(Math.max(...atEnd)).toBeCloseTo(5, 9);
		});

		/**
		 * Opening above the eave: the Opening's spring and jambs belong to the profile's
		 * peak, not to `wall.height`. The closed-solid oracle plus the analytic volume
		 * (wall prism under the sloped top, less the void) catch a clamp to the eave,
		 * a missing breakpoint, or a top edge that stair-steps through a band.
		 */
		describe('Openings above the eave', () => {
			const T = 0.2;
			const window = (id: string, offset: number, width: number, sillHeight: number, height: number) => ({
				id,
				wallId: 'w1',
				kind: 'window',
				offset,
				width,
				height,
				sillHeight,
				profile: 'rectangular'
			});
			const closedVolume = (document: LayoutDocumentWallFirst, expected: number, digits = 6): void => {
				const tris = triangles(meshes(document));
				expect(openEdges(tris)).toEqual([]);
				expect(vectorArea(tris)).toBeLessThan(1e-6);
				expect(Math.abs(signedVolume(tris))).toBeCloseTo(expected, digits);
			};

			it('a window wholly above the eave of a slope is closed and exact', () => {
				// Tops run 3 -> 5 over 5 m: area 20 m2; the 1 x 1 window (sill 3.2, top 4.2) is below the top at x = 3.5 (4.4).
				closedVolume(
					layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b', { top: slope(0, 2) })], [window('o1', 3.5, 1, 3.2, 1)]),
					T * 20 - T * 1
				);
			});

			it('the sloped top crosses a band breakpoint between samples without a gap', () => {
				// The sill 4.05 and spring 4.55 are band breakpoints the top crosses at x = 2.625 and 3.875:
				// stations between the 0.25 m samples, so only an exact knot keeps the front face on the line.
				const document = layout(
					{ a: [0, 0], b: [5, 0] },
					[wall('w1', 'a', 'b', { top: slope(0, 2) })],
					[window('o1', 3.9, 0.8, 4.05, 0.5)]
				);
				closedVolume(document, T * 20 - T * 0.8 * 0.5);
				const front = triangles(meshes(document)).filter((tri) => tri.every((p) => Math.abs(Math.abs(p[2]) - 0.1) < 1e-6 && Math.sign(p[2]) === Math.sign(tri[0]![2])));
				// Both faces are exactly the area under the sloped top, less the window.
				const area = front.reduce((sum, [a, b, c]) => sum + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2, 0);
				expect(area).toBeCloseTo(2 * (20 - 0.8 * 0.5), 6);
				expect(front.some((tri) => tri.some((p) => Math.abs(p[0] - 2.625) < 1e-6 && Math.abs(p[1] - 4.05) < 1e-6))).toBe(true);
				for (const tri of front) for (const p of tri) expect(p[1]).toBeLessThanOrEqual(3 + 0.4 * p[0] + 1e-5);
			});

			it('a Room-bound slope ring keeps a window above the Room eave, closed and exact', () => {
				const document = layout(
					square,
					[
						wall('w1', 'a', 'b', { top: slope(0, 2) }),
						wall('w2', 'b', 'c', { top: slope(2, 0) }),
						wall('w3', 'c', 'd', { top: slope(0, 2) }),
						wall('w4', 'd', 'a', { top: slope(2, 0) })
					],
					[window('o1', 3.5, 1, 3.2, 1)]
				);
				(document as { rooms: unknown[] }).rooms = [
					{
						id: 'r1',
						name: 'Room',
						virtualEdges: [],
						boundary: ['w1', 'w2', 'w3', 'w4'].map((wallId) => ({ wallId, direction: 'forward' }))
					}
				];
				expect(compileWallFirstLayoutGeometry(document).issues ?? []).toEqual([]);
				const room = compileRoom(document);
				// The Room's eave ceiling is 3 m; the window springs above it.
				expect(room.ceilingElevation).toBe(3);
				const built = buildRoomWallMesh(room, { assertWinding: true });
				expect(built.issues).toEqual([]);
				const tris = triangles([built.mesh!]);
				expect(openEdges(tris)).toEqual([]);
				expect(vectorArea(tris)).toBeLessThan(1e-6);
				// Room ring volume: every Wall is a slope with a 4 m mean top, less the 1 x 1 window
				// void. The four tops meet at the corners, so the ring closes (a Room ring whose
				// neighbouring Walls differ in top is open on `main` too, level or profiled).
				const expected = T * (4 * (5 + 4 + 5 + 4) - 1);
				// A mitre adds corner material, so compare within 1.5%.
				expect(Math.abs(signedVolume(tris))).toBeGreaterThan(expected * 0.985);
				expect(Math.abs(signedVolume(tris))).toBeLessThan(expected * 1.015);
			});

			it('a gable Opening straddling the apex is closed and exact', () => {
				// Tops run 3 -> 5 -> 3: area 5 * 3 + 5 = 20 m2; the window spans the apex at 2.5.
				closedVolume(
					layout(
						{ a: [0, 0], b: [5, 0] },
						[wall('w1', 'a', 'b', { top: { kind: 'gable', startRise: 0, endRise: 0, apexRise: 2, apexOffset: 2.5 } })],
						[window('o1', 2, 1, 3.2, 1)]
					),
					T * 20 - T * 1
				);
			});

			it('a curved profiled Wall with an Opening above the eave is closed, and its volume follows the arc length', () => {
				const document = layout({ a: [0, 0], b: [10, 0] }, [
					wall('w1', 'a', 'b', {
						height: 2,
						top: slope(0, 3),
						centerline: {
							kind: 'cubic-chain',
							knots: [{ id: 'k1', point: [5, 3] }],
							spans: [
								{ handleOut: [2, 0], handleIn: [3, 3] },
								{ handleOut: [7, 3], handleIn: [8, 0] }
							]
						} as LayoutWall['centerline']
					})
				]);
				const length = compileWallFirstLayoutGeometry(document).geometry.walls[0]!.length;
				const withWindow = layout(document.junctions.reduce<Record<string, LayoutVec2>>((all, j) => ({ ...all, [j.id]: j.point }), {}), document.walls, [
					window('o1', 0.6 * length, 1, 2.2, 0.5)
				]);
				const tris = triangles(meshes(withWindow));
				expect(openEdges(tris)).toEqual([]);
				expect(vectorArea(tris)).toBeLessThan(1e-6);
				// Mean top 3.5 along the arc, less the 1 x 0.5 void, within the polyline error.
				const expected = T * (length * 3.5 - 0.5);
				expect(Math.abs(signedVolume(tris))).toBeGreaterThan(expected * 0.97);
				expect(Math.abs(signedVolume(tris))).toBeLessThan(expected * 1.03);
			});
		});
	});

	/**
	 * Limits that exist on `main` too (the report compares them). They are pinned so
	 * a change to them is seen; they are not the behaviour a fix should preserve.
	 */
	describe('known limits', () => {
		const corner = (degrees: number): LayoutDocumentWallFirst => {
			const r = (degrees * Math.PI) / 180;
			return layout({ a: [0, 0], b: [5, 0], c: [5 - 4 * Math.cos(r), 4 * Math.sin(r)] }, [wall('w1', 'a', 'b'), wall('w2', 'b', 'c')]);
		};
		const built = (document: LayoutDocumentWallFirst): IndexedWallMesh[] => {
			const compiled = compileWallFirstLayoutGeometry(document);
			const joins = legJoinsByWall(compiled.geometry.junctions);
			return compiled.geometry.walls.map((compiledWall) => buildStandaloneWallMesh(compiledWall, 0, joins.get(compiledWall.wallId) ?? null).mesh!);
		};

		it('a 30° mitre winds a triangle against its normal, though it closes', () => {
			const all = built(corner(30));
			expect(() => assertWindingAgreesWithNormals(all[0]!)).toThrow(/winds opposite/);
			expect(openEdges(triangles(all))).toEqual([]);
		});

		it.each([20, 12])('a %d° bevel stays open at the corner', (degrees) => {
			expect(openEdges(triangles(built(corner(degrees))))).toHaveLength(12);
		});

		it('an arched Opening at a free end leaves a gap between its spring and its height', () => {
			const tris = triangles(
				built(
					layout({ a: [0, 0], b: [5, 0] }, [wall('w1', 'a', 'b')], [
						{ id: 'o1', wallId: 'w1', kind: 'door', offset: 0, width: 1, height: 2.2, sillHeight: 0, profile: 'rounded' }
					])
				)
			);
			const open = openEdges(tris);
			expect(open).toHaveLength(4);
			for (const [a, b] of open) {
				expect(a[0]).toBe(0);
				expect(b[0]).toBe(0);
				// Between the 1.7 m spring and the 2.2 m height.
				for (const y of [a[1], b[1]]) {
					expect(y).toBeGreaterThan(1.69);
					expect(y).toBeLessThan(2.21);
				}
			}
		});
	});
});
