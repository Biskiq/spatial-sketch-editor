/**
 * P23.15 Task 4 — canonical Junction seam acceptance (fail closed).
 *
 * Validity is decided at canonical compile acceptance, from the **resolved**
 * geometry, and the same pure predicate is repeated by both mesh builders as
 * defense-in-depth. The parity triad is the point:
 *
 * ```text
 * compiler issue == editor builder defensive issue == museum builder defensive issue
 * ```
 *
 * Production validity is analytic — finite coordinates, positive band spans, a
 * non-collapsed seam polygon, a resolved end per join — never sampled grid
 * coverage. Every code is pinned with a constructed fixture, and the four codes
 * are also exercised end to end through a document the compiler refuses.
 */
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	joinSeamFailure,
	junctionSeamFailureOf,
	legJoinsByWall,
	resolveJunctionGeometry,
	wallEndsSeamFailure,
	type CompiledJunctionSurface,
	type CompiledJunctionLeg,
	type CompiledJunctionResolution,
	type CompiledLegJoin,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh as buildEditorWallMesh } from '$lib/layout/wall-mesh-builder';
import { buildStandaloneWallMesh as buildMuseumWallMesh } from '../../../../museum/src/lib/layout/wall-mesh-builder';

function wall(id: string, startJunctionId: string, endJunctionId: string): LayoutWall {
	return {
		id,
		startJunctionId,
		endJunctionId,
		role: 'partition',
		thickness: 0.2,
		height: 3,
		centerline: { kind: 'line' }
	} as LayoutWall;
}

function document(junctions: Array<{ id: string; point: LayoutVec2 }>, walls: LayoutWall[]): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions,
		walls,
		rooms: [],
		openings: [],
		objects: []
	};
}

/** One straight Wall, both ends degree 1 — a legal, unremarkable Junction set. */
function straightDocument(): LayoutDocumentWallFirst {
	return document(
		[
			{ id: 'j1', point: [0, 0] },
			{ id: 'j2', point: [4, 0] }
		],
		[wall('w1', 'j1', 'j2')]
	);
}

/** A degree-2 fold: both Walls leave one Junction in exactly the same direction. */
function foldDocument(): LayoutDocumentWallFirst {
	return document(
		[
			{ id: 'jam', point: [0, 0] },
			{ id: 'jb', point: [4, 0] },
			{ id: 'jc', point: [8, 0] }
		],
		[wall('w1', 'jam', 'jb'), wall('w2', 'jam', 'jc')]
	);
}

function leg(wallId: string, rayDegrees: number, halfThickness = 0.1): CompiledJunctionLeg {
	const radians = (rayDegrees * Math.PI) / 180;
	const tangentOut: LayoutVec2 = [Math.cos(radians), Math.sin(radians)];
	return {
		wallId,
		end: 'start',
		tangentOut,
		normalOut: [-tangentOut[1]!, tangentOut[0]!],
		outwardAngle: radians,
		thickness: halfThickness * 2,
		halfThickness,
		bottomY: 0,
		topY: 3,
		role: 'partition',
		endpointOpen: false,
		endpointSolidBands: [{ bottomY: 0, topY: 3, solid: true }]
	};
}

function join(overrides: Partial<CompiledLegJoin> = {}): CompiledLegJoin {
	return {
		wallId: 'w1',
		end: 'start',
		kind: 'miter',
		endBoundary: [],
		interfaceSuppressed: false,
		ownedSeam: null,
		bands: [{ bottomY: 0, topY: 3 }],
		corner: { front: { kind: 'miter', apex: [0.1, 0] }, back: { kind: 'miter', apex: [-0.1, 0] } },
		...overrides
	};
}

function resolution(joins: CompiledLegJoin[]): CompiledJunctionResolution {
	return { junctionId: 'j', legOrder: [], joins, bounds2: { min: [-0.1, -0.1], max: [0.1, 0.1] } };
}

/** The parity triad for a constructed join: compile-path code, then both builders. */
function triad(constructed: CompiledLegJoin): { compile: string; editor: string; museum: string } {
	const compileCode = wallEndsSeamFailure({ start: constructed, end: null })!.code;
	const compilation = compileWallFirstLayoutGeometry(straightDocument());
	const compiled = compilation.geometry.walls[0]!;
	const real = legJoinsByWall(compilation.geometry.junctions).get('w1')!;
	const ends = { start: { ...constructed, wallId: compiled.wallId }, end: real.end };
	const editor = buildEditorWallMesh(compiled, 0, ends);
	const museum = buildMuseumWallMesh(compiled, 0, ends);
	expect(editor.mesh).toBeUndefined();
	expect(museum.mesh).toBeUndefined();
	expect(editor.issues).toHaveLength(1);
	expect(museum.issues).toHaveLength(1);
	return { compile: compileCode, editor: editor.issues[0]!.code, museum: museum.issues[0]!.code };
}

describe('P23.15 Task 4 — junction seam acceptance', () => {
	it('pins junction_seam_fold at the Junction and on the resolved joins', () => {
		const legs = [leg('wa', 0), leg('wb', 0)];
		const failure = junctionSeamFailureOf({ junctionId: 'j', point: [0, 0], legs, resolution: resolution([join({ fold: true })]) });
		expect(failure?.code).toBe('junction_seam_fold');

		// The same code from the Wall-decidable path, and from both builders.
		expect(triad(join({ fold: true }))).toEqual({
			compile: 'junction_seam_fold',
			editor: 'junction_seam_fold',
			museum: 'junction_seam_fold'
		});
	});

	it('pins junction_seam_degenerate for a non-finite coordinate and a zero-span band', () => {
		const legs = [leg('wa', 0), leg('wb', 90)];
		expect(junctionSeamFailureOf({ junctionId: 'j', point: [NaN, 0], legs, resolution: resolution([join()]) })?.code).toBe(
			'junction_seam_degenerate'
		);
		const nonFiniteLeg = leg('wb', 90);
		nonFiniteLeg.tangentOut = [NaN, 0];
		expect(
			junctionSeamFailureOf({ junctionId: 'j', point: [0, 0], legs: [leg('wa', 0), nonFiniteLeg], resolution: resolution([join()]) })
				?.code
		).toBe('junction_seam_degenerate');
		expect(
			junctionSeamFailureOf({
				junctionId: 'j',
				point: [0, 0],
				legs,
				resolution: resolution([join({ bands: [{ bottomY: 1.2, topY: 1.2 }] })])
			})?.code
		).toBe('junction_seam_degenerate');

		expect(triad(join({ bands: [{ bottomY: 1.2, topY: 1.2 }] }))).toEqual({
			compile: 'junction_seam_degenerate',
			editor: 'junction_seam_degenerate',
			museum: 'junction_seam_degenerate'
		});
	});

	it('pins junction_seam_overlap for a collapsed seam polygon', () => {
		const collapsed = join({ ownedSeam: { sector: 0, polygon: [[0, 0], [0.1, 0], [0.2, 0]] } });
		expect(
			junctionSeamFailureOf({ junctionId: 'j', point: [0, 0], legs: [leg('wa', 0), leg('wb', 90)], resolution: resolution([collapsed]) })
				?.code
		).toBe('junction_seam_overlap');
		expect(triad(collapsed)).toEqual({
			compile: 'junction_seam_overlap',
			editor: 'junction_seam_overlap',
			museum: 'junction_seam_overlap'
		});
	});

	it('pins junction_seam_uncovered for an end the resolution left unresolved', () => {
		const unresolved = join({ kind: 'miter', corner: null, interfaceSuppressed: false });
		expect(
			junctionSeamFailureOf({ junctionId: 'j', point: [0, 0], legs: [leg('wa', 0), leg('wb', 90)], resolution: resolution([unresolved]) })
				?.code
		).toBe('junction_seam_uncovered');
		expect(triad(unresolved)).toEqual({
			compile: 'junction_seam_uncovered',
			editor: 'junction_seam_uncovered',
			museum: 'junction_seam_uncovered'
		});
	});

	it('accepts a resolved corner, a continuation and a terminal cap', () => {
		const legs = [leg('wa', 0), leg('wb', 90)];
		expect(
			junctionSeamFailureOf({ junctionId: 'j', point: [0, 0], legs, resolution: resolution([join()]) })
		).toBeUndefined();
		expect(
			junctionSeamFailureOf({
				junctionId: 'j',
				point: [0, 0],
				legs,
				resolution: resolution([join({ kind: 'suppressed', corner: null, interfaceSuppressed: true })])
			})
		).toBeUndefined();
		expect(
			junctionSeamFailureOf({
				junctionId: 'j',
				point: [0, 0],
				legs: [leg('wa', 0)],
				resolution: resolution([join({ kind: 'terminal', corner: null })])
			})
		).toBeUndefined();
	});

	it('reports a document-level fold once, through the canonical compile gate', () => {
		const compilation = compileWallFirstLayoutGeometry(foldDocument());
		const blocking = compilation.issues.filter((issue) => issue.severity !== 'warning');
		expect(blocking.map((issue) => issue.code)).toEqual(['junction_seam_fold']);
		expect(blocking[0]!.targetId).toBe('jam');

		// The renderer repeats the same rule, with the same code, from the resolved
		// ends it was given — never a first discovery.
		const ends = legJoinsByWall(compilation.geometry.junctions).get('w1')!;
		const compiled = compilation.geometry.walls.find((candidate) => candidate.wallId === 'w1')!;
		const editor = buildEditorWallMesh(compiled, 0, ends);
		const museum = buildMuseumWallMesh(compiled, 0, ends);
		expect(editor.issues.map((issue) => issue.code)).toEqual(['junction_seam_fold']);
		expect(museum.issues.map((issue) => issue.code)).toEqual(['junction_seam_fold']);
	});

	it('rejects a zero-span resolved surface and duplicate ownership analytically', () => {
		const legs: CompiledJunctionLeg[] = [leg('w1', 0), leg('w2', 180)];
		const resolved = resolveJunctionGeometry('j', [0, 0], legs);
		const owner = resolved.resolution.joins[0]!;
		const sound: CompiledLegJoin = {
			...owner,
			surfaces: [
				{
					ownerWallId: owner.wallId,
					end: owner.end,
					kind: 'continuation-thickness-step',
					from: [0, 0.1],
					to: [0, 0.2],
					normal: [1, 0],
					bands: [{ bottomY: 0, topY: 3 }]
				}
			]
		};
		expect(joinSeamFailure(sound)).toBeUndefined();
		// Zero plan span: a degenerate sliver, not a surface.
		expect(
			joinSeamFailure({ ...sound, surfaces: [{ ...sound.surfaces![0]!, to: [0, 0.1] }] })?.code
		).toBe('junction_seam_overlap');
		// Zero vertical span: a zero-height surface.
		expect(
			joinSeamFailure({ ...sound, surfaces: [{ ...sound.surfaces![0]!, bands: [{ bottomY: 1, topY: 1 }] }] })?.code
		).toBe('junction_seam_degenerate');
		// A clipped (trimmed) end that is not an interface would be an open hole.
		expect(joinSeamFailure({ ...sound, clipDistance: 0.1, interfaceSuppressed: false })?.code).toBe(
			'junction_seam_uncovered'
		);
		// Duplicate ownership: two Walls owning the same resolved region.
		const other = resolved.resolution.joins[1]!;
		const shared: CompiledJunctionSurface = sound.surfaces![0]!;
		const stolen: CompiledJunctionSurface = { ...shared, ownerWallId: other.wallId, end: other.end };
		const resolution: CompiledJunctionResolution = {
			...resolved.resolution,
			joins: [sound, { ...other, surfaces: [stolen] }]
		};
		expect(junctionSeamFailureOf({ junctionId: 'j', point: [0, 0], legs, resolution })?.code).toBe(
			'junction_seam_overlap'
		);
	});

	it('pins keel validation: malformed resolved keel material fails closed everywhere', () => {
		// A resolved keel is emitted physical geometry — the builders extrude its
		// regions into top/bottom faces — so the canonical predicate validates it
		// like every other resolved fact and the parity triad rejects the same
		// malformed keel before any builder can silently skip it.
		const band = { bottomY: 0, topY: 3 };
		const region: LayoutVec2[] = [[0, 0], [0.2, 0], [0.1, 0.15]];
		// Positive control: the declared shape (convex CCW polygon + real band).
		expect(joinSeamFailure(join({ keel: { regions: [region], bands: [band] } }))).toBeUndefined();

		// Degenerate class: a keel that carries no material, a non-finite vertex,
		// or a band with no vertical span.
		const degenerate = [
			join({ keel: { regions: [], bands: [band] } }),
			join({ keel: { regions: [region], bands: [] } }),
			join({ keel: { regions: [[[0, 0], [NaN, 0], [0.1, 0.15]]], bands: [band] } }),
			join({ keel: { regions: [region], bands: [{ bottomY: 1, topY: 1 }] } }),
			join({ keel: { regions: [region], bands: [{ bottomY: 0, topY: NaN }] } })
		];
		for (const constructed of degenerate) {
			expect(joinSeamFailure(constructed)?.code).toBe('junction_seam_degenerate');
			expect(triad(constructed)).toEqual({
				compile: 'junction_seam_degenerate',
				editor: 'junction_seam_degenerate',
				museum: 'junction_seam_degenerate'
			});
		}

		// Overlap class: the region is not the declared convex CCW polygon — under
		// three vertices, collapsed at its own scale (collinear), a reflex turn, or
		// CW wound (a keel's top-face normal must be `+Y`). The builders
		// fan-triangulate from the first vertex, which is wrong for exactly these
		// shapes — so they must be rejected, not silently skipped.
		const malformed: LayoutVec2[][][] = [
			[[[0, 0], [0.2, 0]]],
			[[[0, 0], [0.1, 0], [0.2, 0]]],
			[[[0, 0], [0.2, 0.2], [0.4, 0], [0.4, 0.3], [0, 0.3]]],
			[[[0, 0], [0.1, 0.15], [0.2, 0]]]
		];
		for (const regions of malformed) {
			const constructed = join({ keel: { regions, bands: [band] } });
			expect(joinSeamFailure(constructed)?.code).toBe('junction_seam_overlap');
			expect(triad(constructed)).toEqual({
				compile: 'junction_seam_overlap',
				editor: 'junction_seam_overlap',
				museum: 'junction_seam_overlap'
			});
		}
		// The Junction-level path reports the same code for the same keel.
		const collapsed = join({ keel: { regions: [[[0, 0], [0.1, 0], [0.2, 0]]], bands: [band] } });
		expect(
			junctionSeamFailureOf({
				junctionId: 'j',
				point: [0, 0],
				legs: [leg('wa', 0), leg('wb', 90)],
				resolution: resolution([collapsed])
			})?.code
		).toBe('junction_seam_overlap');

		// The shape pin must never false-positive on what the solver actually
		// emits: a real Y/star partition's keels all pass the same predicate.
		const star = resolveJunctionGeometry('j', [0, 0], [leg('wa', 0), leg('wb', 120), leg('wc', 240)]);
		expect(star.resolution.joins.some((entry) => entry.keel !== undefined)).toBe(true);
		for (const entry of star.resolution.joins) expect(joinSeamFailure(entry)).toBeUndefined();
	});

	it('accepts every ordinary Junction the compiler compiles today', () => {
		const straight = compileWallFirstLayoutGeometry(straightDocument());
		expect(straight.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		const corner = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'ja', point: [-4, 0] },
					{ id: 'jm', point: [0, 0] },
					{ id: 'jb', point: [0, 4] }
				],
				[wall('w1', 'ja', 'jm'), wall('w2', 'jm', 'jb')]
			)
		);
		expect(corner.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
		// A degree-3 T with a collinear through-pair is not a fold.
		const tee = compileWallFirstLayoutGeometry(
			document(
				[
					{ id: 'j', point: [0, 0] },
					{ id: 'ja', point: [-4, 0] },
					{ id: 'jb', point: [4, 0] },
					{ id: 'jc', point: [0, 4] }
				],
				[wall('w1', 'ja', 'j'), wall('w2', 'j', 'jb'), wall('w3', 'j', 'jc')]
			)
		);
		expect(tee.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	});
});
