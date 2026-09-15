/**
 * P23.11 Slice 6 — render-safe validation (Issue #6).
 *
 * A Wall is a solid of finite `thickness`, so its centerline is offset by
 * ±thickness/2. A bend tighter than that half-thickness folds the offset
 * polyline, and a Wall that passes closer than its own thickness to itself
 * overlaps it. Both are properties of the compiled samples, so they are decided
 * by the canonical acceptance path — the same samples the renderers consume —
 * instead of being discovered while building a mesh.
 *
 * The cubic-chain representation did not change this seam: the predicate reads
 * samples and a thickness, and the chain supplies both through the one
 * evaluator. This slice therefore re-pins the guarantee on chain fixtures
 * rather than adding a second implementation.
 *
 * The same pure predicate (`layout-core`) is used by canonical compile, the
 * editor mesh builder and the museum mesh builder. The two mesh builders are
 * one file kept byte-identical, so the editor and museum cannot drift; the test
 * below asserts that invariant rather than trusting it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	planBendWallCurveKnot,
	planMoveWallCurveKnot,
	sampleSegment,
	wallCenterlineSegment,
	wallCubicChain,
	wallCurveKnotArcDistance,
	wallOffsetClearanceFailure,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';
import { buildStandaloneWallMesh } from '$lib/layout/wall-mesh-builder';

const CHORD = 6;
/**
 * A deliberately thick partition: at 8 m of thickness the midpoint bow below
 * is only 3 m of radius, well inside half the thickness.
 */
const THICK = 8;

/**
 * Roomless partition Wall whose single bend point sits at `anchor`. The bow is
 * mild enough at `[3, 0.5]` to clear the thickness and violent enough at
 * `[3, 2]` / `[3, 3]` not to.
 *
 * The chain is authored with the canonical write-path rule
 * (`deriveChainSpans`), i.e. exactly the geometry the old anchor representation
 * would have compiled, so these fixtures keep their meaning across the
 * representation change.
 */
function thickWallDocument(anchor: LayoutVec2, thickness = THICK): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-p1', point: [0, 0] },
		{ id: 'j-p2', point: [CHORD, 0] }
	];
	const knot: LayoutWallCurveKnot = { id: 'anchor:1', point: [anchor[0], anchor[1]] };
	document.walls = [
		{
			id: 'wall-p',
			startJunctionId: 'j-p1',
			endJunctionId: 'j-p2',
			role: 'partition',
			thickness,
			height: 3,
			centerline: wallCubicChain([knot], deriveChainSpans([[0, 0], knot.point, [CHORD, 0]]))
		} as LayoutWall
	];
	return document;
}

function blockingCodes(document: LayoutDocumentWallFirst): string[] {
	return compileWallFirstLayoutGeometry(document)
		.issues.filter((issue) => issue.severity !== 'warning')
		.map((issue) => issue.code);
}

function clearanceOf(document: LayoutDocumentWallFirst, thickness = THICK) {
	const wall = document.walls[0]!;
	const sampled = sampleSegment(wallCenterlineSegment(wall, [0, 0], [CHORD, 0], 'forward'));
	return wallOffsetClearanceFailure(sampled.samples, thickness);
}

describe('P23.11 slice 6 — Issue #6 rejects before commit', () => {
	it('accepts a thick Wall whose bend clears its own thickness', () => {
		const baseline = thickWallDocument([3, 0.5]);
		expect(clearanceOf(baseline)).toBeUndefined();
		expect(blockingCodes(baseline)).toEqual([]);
	});

	it('rejects the edit that folds the offset, naming the Wall', () => {
		const baseline = thickWallDocument([3, 0.5]);
		const snapshot = JSON.stringify(baseline);

		const plan = planMoveWallCurveKnot(baseline, 'wall-p', 'anchor:1', [3, 2]);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		// The canonical acceptance path owns the refusal: no document or history
		// commit ever sees a Wall the mesh path cannot render.
		expect(plan.rejection.code).toBe('geometry_invalid');
		expect(plan.rejection.message.toLowerCase()).toContain('fold');
		// Rejection is atomic — the baseline is untouched.
		expect(JSON.stringify(baseline)).toBe(snapshot);
	});

	it('rejects the edit that necks the Wall into itself', () => {
		const plan = planMoveWallCurveKnot(thickWallDocument([3, 0.5]), 'wall-p', 'anchor:1', [3, 3]);
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.code).toBe('geometry_invalid');
		expect(plan.rejection.message.toLowerCase()).toContain('neck');
	});

	it('routes the Bend gesture through the same refusal', () => {
		// The composite Bend planner inserts AND places in one candidate, so it
		// is the easiest place for the gate to be bypassed. Grabbing the existing
		// bend point's own arc distance promotes it, and the release point folds
		// the same solid the move planner refuses.
		const document = thickWallDocument([3, 0.5]);
		const wall = document.walls[0]!;
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('expected a chain');
		const distance = wallCurveKnotArcDistance(
			{
				startPoint: [0, 0],
				endPoint: [CHORD, 0],
				knots: wall.centerline.knots,
				spans: wall.centerline.spans
			},
			'anchor:1'
		)!;
		const plan = planBendWallCurveKnot(document, 'wall-p', { distance, point: [3, 2] });
		expect(plan.kind).toBe('rejected');
		if (plan.kind !== 'rejected') return;
		expect(plan.rejection.message.toLowerCase()).toContain('fold');
	});

	it('accepts the same edit once the geometry is corrected', () => {
		const plan = planMoveWallCurveKnot(thickWallDocument([3, 0.5]), 'wall-p', 'anchor:1', [3, 0.2]);
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(blockingCodes(plan.document)).toEqual([]);
	});

	it('decides on thickness, not on curvature', () => {
		// Identical centerline, ordinary 0.2 m thickness: perfectly buildable.
		const thin = thickWallDocument([3, 2], 0.2);
		expect(clearanceOf(thin, 0.2)).toBeUndefined();
		expect(blockingCodes(thin)).toEqual([]);
		// Same curve, thick Wall: the solid folds.
		expect(clearanceOf(thickWallDocument([3, 2]))).toBe('fold');
		expect(blockingCodes(thickWallDocument([3, 2]))).toEqual(['wall_offset_fold']);
	});

	it('leaves straight Walls unaffected at any thickness', () => {
		const document = thickWallDocument([3, 0.5]);
		document.walls[0]!.centerline = { kind: 'line' };
		document.walls[0]!.thickness = 100;
		expect(clearanceOf(document, 100)).toBeUndefined();
		expect(blockingCodes(document)).toEqual([]);
	});
});

describe('P23.11 slice 6 — core and the mesh builders agree', () => {
	it('reports the same code from canonical compile and the editor mesh path', () => {
		const folded = thickWallDocument([3, 2]);
		const compilation = compileWallFirstLayoutGeometry(folded);
		const compiled = compilation.geometry.walls.find((wall) => wall.wallId === 'wall-p')!;
		const codes = compilation.issues
			.filter((issue) => issue.severity !== 'warning')
			.map((issue) => issue.code);
		expect(codes).toEqual(['wall_offset_fold']);

		// Defense-in-depth: the builder refuses the same Wall, with the same
		// code, without a second copy of the rule.
		const built = buildStandaloneWallMesh(compiled, 0);
		expect(built.mesh).toBeUndefined();
		expect(built.issues.map((issue) => issue.code)).toEqual(['wall_offset_fold']);
		expect(built.issues[0]!.targetId).toBe('wall-p');
	});

	it('builds a mesh for the accepted fixture', () => {
		const compilation = compileWallFirstLayoutGeometry(thickWallDocument([3, 0.5]));
		const compiled = compilation.geometry.walls.find((wall) => wall.wallId === 'wall-p')!;
		const built = buildStandaloneWallMesh(compiled, 0);
		expect(built.issues).toEqual([]);
		expect(built.mesh).toBeDefined();
		expect(built.mesh!.positions.length).toBeGreaterThan(0);
	});

	it('keeps the editor and museum mesh builders byte-identical', () => {
		// The two builders are deliberately one file duplicated across the two
		// apps. The shared predicate is what makes them agree on validity; this
		// assertion keeps the rest of the builder from drifting apart silently —
		// which is what makes the editor result the museum result.
		const editorBuilder = resolve(process.cwd(), 'src/lib/layout/wall-mesh-builder.ts');
		const museumBuilder = resolve(process.cwd(), '../museum/src/lib/layout/wall-mesh-builder.ts');
		expect(readFileSync(editorBuilder, 'utf8')).toBe(readFileSync(museumBuilder, 'utf8'));
	});
});

describe('P23.11 slice 6 — dependency direction stays intact', () => {
	it('gives layout-core no renderer or app dependency', () => {
		const sourceRoot = resolve(process.cwd(), '../../packages/layout-core/src');
		const offenders: string[] = [];
		let inspected = 0;
		for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
			inspected += 1;
			const source = readFileSync(join(sourceRoot, entry.name), 'utf8');
			for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
				const specifier = match[1]!;
				if (
					/^(three|@threlte|svelte|@sveltejs)/.test(specifier) ||
					specifier.includes('apps/') ||
					/^\.\.\//.test(specifier)
				) {
					offenders.push(`${entry.name} → ${specifier}`);
				}
			}
		}
		// Guard against a vacuous pass: the scan must actually have read the
		// canonical sources it claims to police.
		expect(inspected).toBeGreaterThan(20);
		expect(offenders).toEqual([]);
	});

	it('gives the museum no editor dependency', () => {
		const museumRoot = resolve(process.cwd(), '../museum/src');
		const offenders: string[] = [];
		let inspected = 0;
		const walk = (directory: string): void => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) {
					walk(path);
					continue;
				}
				if (!/\.(ts|svelte)$/.test(entry.name)) continue;
				inspected += 1;
				const source = readFileSync(path, 'utf8');
				for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
					const specifier = match[1]!;
					if (specifier.includes('apps/editor') || specifier.startsWith('$lib/editor')) {
						offenders.push(`${entry.name} → ${specifier}`);
					}
				}
			}
		};
		walk(museumRoot);
		expect(inspected).toBeGreaterThan(20);
		expect(offenders).toEqual([]);
	});
});
