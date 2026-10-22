/**
 * P23.11 fix 6 — finite-thickness clearance audit.
 *
 * The invariant: the guard is decided from the same samples the standalone mesh
 * builder consumes, so anything canonical validation accepts must build. Core's
 * verdict and the builder's verdict cannot disagree, because one pure predicate
 * decides both — never a stricter or looser copy.
 *
 * WP3T removed the duplicate execution this file used to carry: both mesh-call
 * sites imported the SAME `$lib/layout/wall-mesh-builder` under an editor alias
 * and a museum alias, so each fixture ran one builder twice and re-asserted one
 * result. `apps/museum` was retired by #115 (§3.5), so the pair had no second
 * subject; one compiler-to-mesh proof per fixture remains.
 *
 * Split by behavioural seam out of `layout-curve-regressions.test.ts`
 * (PR #115 WP3T, plan §7.6 areas 2–3).
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	CURVE_SELF_INTERSECTION_TOLERANCE,
	deriveChainSpans,
	LAYOUT_GEOMETRY_EPSILON,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	legJoinsByWall,
	sampleSegment,
	wallCenterlineSegment,
	wallCubicChain,
	wallOffsetClearanceFailure,
	type CurveSample,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCubicSpan,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

const LINE = { kind: 'line' } as const;

function wallOf(document: LayoutDocumentWallFirst, wallId: string): LayoutWall {
	return document.walls.find((wall) => wall.id === wallId)!;
}

describe('P23.11 fix 6 — clearance predicate audit', () => {
	function wallDocument(anchor: LayoutVec2, thickness: number): LayoutDocumentWallFirst {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 'j-p1', point: [0, 0] },
			{ id: 'j-p2', point: [6, 0] }
		];
		const knot: LayoutWallCurveKnot = { id: 'anchor:1', point: [anchor[0], anchor[1]] };
		document.walls = [
			{
				id: 'wall-p',
				startJunctionId: 'j-p1',
				endJunctionId: 'j-p2',
				thickness,
				height: 3,
				centerline: wallCubicChain([knot], deriveChainSpans([[0, 0], knot.point, [6, 0]]))
			} as LayoutWall
		];
		return document;
	}

	function blockingCodes(document: LayoutDocumentWallFirst): string[] {
		return compileWallFirstLayoutGeometry(document)
			.issues.filter((issue) => issue.severity !== 'warning')
			.map((issue) => issue.code);
	}

	function clearanceOf(document: LayoutDocumentWallFirst) {
		const wall = document.walls[0]!;
		const sampled = sampleSegment(wallCenterlineSegment(wall, [0, 0], [6, 0], 'forward'));
		return wallOffsetClearanceFailure(sampled.samples, wall.thickness);
	}

	function unevenHandleDocument(thickness: number): LayoutDocumentWallFirst {
		const document = createEmptyWallFirstLayoutDocument();
		document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
		document.junctions = [
			{ id: 'j-u1', point: [0, 0] },
			{ id: 'j-u2', point: [8, 0] }
		];
		document.walls = [
			{
				id: 'wall-uneven',
				startJunctionId: 'j-u1',
				endJunctionId: 'j-u2',
				thickness,
				height: 3,
				centerline: wallCubicChain([], [
					{ handleOut: [0.2, 5], handleIn: [7.2, 1] } satisfies LayoutWallCubicSpan
				])
			} as LayoutWall
		];
		return document;
	}

	/** Exact circular U-turn samples with straight arms, at caller-chosen density. */
	function uTurnSamples(radius: number, arcSteps: number): CurveSample[] {
		const armLength = 6;
		const armSteps = Math.max(4, Math.round(arcSteps / 4));
		const samples: CurveSample[] = [];
		let distance = 0;
		const totalSteps = armSteps * 2 + arcSteps;
		const push = (point: LayoutVec2, tangent: LayoutVec2): void => {
			if (samples.length > 0) {
				const previous = samples.at(-1)!.point;
				distance += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
			}
			samples.push({
				point,
				distance,
				tangent,
				normal: [-tangent[1], tangent[0]],
				t: samples.length / totalSteps
			});
		};
		for (let index = 0; index <= armSteps; index += 1) {
			push([-armLength + (armLength * index) / armSteps, 0], [1, 0]);
		}
		for (let index = 1; index <= arcSteps; index += 1) {
			const theta = -Math.PI / 2 + (Math.PI * index) / arcSteps;
			push([radius * Math.cos(theta), radius + radius * Math.sin(theta)], [-Math.sin(theta), Math.cos(theta)]);
		}
		for (let index = 1; index <= armSteps; index += 1) {
			push([-(armLength * index) / armSteps, 2 * radius], [-1, 0]);
		}
		return samples;
	}

	/**
	 * The invariant: anything canonical validation accepts must be renderable, so
	 * core's verdict and the mesh builder's verdict cannot disagree. The
	 * predicate is one pure function, so this asserts the compile path applies it
	 * exactly where the mesh builder does — never a stricter or looser copy.
	 */
	it('agrees with the mesh path on every accepted/rejected fixture', () => {
		const anchors: LayoutVec2[] = [
			[3, 0.02],
			[3, 0.1],
			[3, 0.4],
			[3, 0.9],
			[3, 1.5],
			[3, 2.5],
			[3, 4]
		];
		for (const anchor of anchors) {
			for (const thickness of [0.2, 1, 3, 6]) {
				const document = wallDocument(anchor, thickness);
				const clearance = clearanceOf(document);
				const codes = blockingCodes(document).filter((code) => code.startsWith('wall_offset') || code === 'wall_clearance_insufficient');
				if (clearance) {
					expect(codes.length, `anchor ${anchor[1]} / thickness ${thickness}`).toBeGreaterThan(0);
				} else {
					expect(codes, `anchor ${anchor[1]} / thickness ${thickness}`).toEqual([]);
				}
			}
		}
	});

	it('keeps a straight Wall unconditionally clear at any thickness', () => {
		const document = wallDocument([3, 0.5], 40);
		document.walls[0]!.centerline = LINE;
		expect(clearanceOf(document)).toBeUndefined();
		expect(blockingCodes(document)).toEqual([]);
	});

	it('classifies a near-parallel return run exactly at the thickness boundary', () => {
		// Adversarial fixture for the neck predicate: two anti-parallel straight
		// runs separated by `gap`, with the connecting pair outside the
		// self-intersection scan. This isolates the `spacing < thickness` rule from
		// the fold rule, so the boundary can be pinned exactly.
		const runs = (gap: number): Parameters<typeof wallOffsetClearanceFailure>[0] => [
			{ point: [0, 0], distance: 0, tangent: [1, 0], normal: [0, 1], t: 0 },
			{ point: [10, 0], distance: 10, tangent: [1, 0], normal: [0, 1], t: 0.4 },
			{ point: [10, gap], distance: 10 + gap, tangent: [-1, 0], normal: [0, -1], t: 0.6 },
			{ point: [0, gap], distance: 20 + gap, tangent: [-1, 0], normal: [0, -1], t: 1 }
		];
		const thickness = 0.4;
		const epsilon = LAYOUT_GEOMETRY_EPSILON;
		// The predicate's strict boundary is `spacing < thickness - ε`.
		// Pin both sides of that intentional numerical policy, not a coarse sample.
		expect(wallOffsetClearanceFailure(runs(thickness - 2 * epsilon), thickness)).toBe('neck');
		expect(wallOffsetClearanceFailure(runs(thickness - epsilon), thickness)).toBeUndefined();
		// Exactly thickness: the offset faces touch but do not overlap → clear.
		expect(wallOffsetClearanceFailure(runs(thickness), thickness)).toBeUndefined();
		// Above thickness by the same epsilon: clear.
		expect(wallOffsetClearanceFailure(runs(thickness + epsilon), thickness)).toBeUndefined();
	});

	it('classifies a tight U-turn at the radius boundary across two sampling densities', () => {
		const thickness = 1;
		const halfThickness = thickness / 2;
		// 0.01 m is small relative to the fixture but safely above the
		// self-intersection predicate's 1e-4 m segment tolerance.
		const delta = Math.max(0.01, 20 * CURVE_SELF_INTERSECTION_TOLERANCE);
		for (const density of [24, 96]) {
			expect(wallOffsetClearanceFailure(uTurnSamples(halfThickness - delta, density), thickness)).toBe('fold');
			expect(wallOffsetClearanceFailure(uTurnSamples(halfThickness, density), thickness)).toBe('fold');
			// The local offset is open above half-thickness, but this tight U-turn
			// still brings opposing centerline portions within one thickness, so the
			// separate global-clearance policy correctly reports a neck.
			expect(wallOffsetClearanceFailure(uTurnSamples(halfThickness + delta, density), thickness), `radius above boundary, density ${density}`).toBe('neck');
		}
	});

	it('keeps an uneven-handle and visually severe non-overlapping curve valid', () => {
		const document = unevenHandleDocument(0.4);
		const wall = wallOf(document, 'wall-uneven');
		const segment = wallCenterlineSegment(wall, [0, 0], [8, 0], 'forward');
		const sparse = sampleSegment(segment, { flatnessTolerance: 0.25, maxSampleSpan: 1 });
		const dense = sampleSegment(segment, { flatnessTolerance: 0.001, maxSampleSpan: 0.05 });
		expect(wallOffsetClearanceFailure(sparse.samples, wall.thickness)).toBeUndefined();
		expect(wallOffsetClearanceFailure(dense.samples, wall.thickness)).toBeUndefined();

		// These are the actual compiled Wall samples the standalone mesh builder
		// consumes, not a second predicate-only verdict.
		const compilation = compileWallFirstLayoutGeometry(document);
		const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === 'wall-uneven')!;
		const ends = legJoinsByWall(compilation.geometry.junctions).get(compiled.wallId) ?? null;
		const mesh = buildStandaloneWallMesh(compiled, 0, ends);
		expect(mesh.issues).toEqual([]);
		expect(mesh.mesh).toBeDefined();
	});

	it('keeps a severe but non-overlapping canonical bend buildable', () => {
		// Radius ≈ 2 m, thickness 0.4 m: the offset radius (1.8 m) is far above
		// the fold boundary (half thickness = 0.2 m), so this must be accepted.
		const document = wallDocument([3, 2], 0.4);
		expect(clearanceOf(document)).toBeUndefined();
		expect(blockingCodes(document)).toEqual([]);
		const compilation = compileWallFirstLayoutGeometry(document);
		const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === 'wall-p')!;
		const ends = legJoinsByWall(compilation.geometry.junctions).get(compiled.wallId) ?? null;
		const mesh = buildStandaloneWallMesh(compiled, 0, ends);
		expect(mesh.issues).toEqual([]);
		expect(mesh.mesh).toBeDefined();
	});
});
