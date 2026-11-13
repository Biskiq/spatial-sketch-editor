/**
 * E4 / I5 — accepted and attempted Openings draw one Plan symbol.
 *
 * The accepted Opening's symbol is `openingPlanSymbol` over the compiled
 * Opening; a refused attempt's is the same builder over the compiler's own
 * centre frame (`openingAttemptSymbolSource`) at its raw values. At the same
 * values on the same Wall they must be equal exactly — on a straight and a
 * curved host, for a door and a window — and an overhanging attempt is drawn
 * at its raw, unclamped position.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometryFresh,
	createClosedWallCircleDocument,
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	openingAttemptSymbolSource,
	openingPlanSymbol,
	planCreateWallFirstOpening,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall
} from '@portfolio/layout-core';

import { openingAttemptPlanPaper } from '$lib/authoring/adapters/layout/candidate-preview';
import { sequentialCaptures } from '../../../perf/lib/workloads/grid';

const CHORD = 6;

function singleWall(centerline: LayoutWall['centerline']): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [CHORD, 0] }
	];
	document.walls = [{ id: 'wall-a', startJunctionId: 'j-a', endJunctionId: 'j-b', thickness: 0.2, height: 3, centerline }];
	return document;
}

function curved(): LayoutWall['centerline'] {
	const points: LayoutVec2[] = [[0, 0], [3, 2], [CHORD, 0]];
	return wallCubicChain([{ id: 'wall-a:knot:1', point: [3, 2] }], deriveChainSpans(points));
}

const HOSTS = [
	['straight', () => singleWall({ kind: 'line' })],
	['curved', () => singleWall(curved())]
] as const;

describe('E4/I5 — one Opening Plan symbol', () => {
	for (const [host, build] of HOSTS) {
		for (const kind of ['door', 'window'] as const) {
			it(`a ${kind} on a ${host} Wall: the attempt symbol equals the accepted symbol`, () => {
				const base = build();
				const plan = planCreateWallFirstOpening(
					base,
					{ wallId: 'wall-a', kind, offset: 1.3 },
					sequentialCaptures(`e4-i5-${host}-${kind}`)(),
					base.floor.id
				);
				if (plan.kind !== 'success') throw new Error(plan.rejection.message);
				const compiled = compileWallFirstLayoutGeometryFresh(plan.document).geometry;
				const wall = compiled.walls[0]!;
				const opening = wall.openings[0]!;
				const accepted = openingPlanSymbol(opening, wall.thickness);
				const attempt = openingPlanSymbol(
					openingAttemptSymbolSource(wall, { kind, offset: opening.offset, width: opening.width }),
					wall.thickness
				);
				expect(attempt).toEqual(accepted);
				expect(accepted.segments.length).toBeGreaterThan(0);

				const paper = openingAttemptPlanPaper(compiled, wall.wallId, { ...opening }, 0.5);
				const flattened = [...accepted.segments, ...accepted.dashedSegments];
				expect(paper.segments.map(([a, b]) => [[a[0], a[2]], [b[0], b[2]]])).toEqual(flattened.map(([a, b]) => [[...a], [...b]]));
				expect(paper.segments.every(([a, b]) => a[1] === 0.5 && b[1] === 0.5)).toBe(true);
			});
		}
	}

	it('a closed host is periodic: an attempt before the seam equals one period on', () => {
		const created = createClosedWallCircleDocument({
			center: [0, 0],
			rim: [5, 0],
			junctionId: 'j-ring',
			wallId: 'wall-ring',
			thickness: 0.2,
			height: 3
		});
		if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
		const wall = compileWallFirstLayoutGeometryFresh(created.document).geometry.walls[0]!;

		// One period is the same physical span: the polyline and the frame agree,
		// rather than the centre wrapping while the jambs clamp to the seam.
		const before = openingAttemptSymbolSource(wall, { kind: 'window', offset: -1, width: 2 });
		const wrapped = openingAttemptSymbolSource(wall, { kind: 'window', offset: wall.length - 1, width: 2 });
		expect(before).toEqual(wrapped);
		expect(before.center.point).toEqual(wrapped.center.point);

		// The refusal stays 2 m long across the seam; a clamp would leave 1 m.
		const arc = before.centerPolyline.slice(1).reduce((sum, point, index) => {
			const previous = before.centerPolyline[index]!;
			return sum + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
		}, 0);
		expect(before.centerPolyline.length).toBeGreaterThanOrEqual(3);
		expect(arc).toBeCloseTo(2, 1);
	});

	it('an accepted Opening crossing the seam and its attempt draw one symbol', () => {
		const created = createClosedWallCircleDocument({
			center: [0, 0],
			rim: [5, 0],
			junctionId: 'j-ring',
			wallId: 'wall-ring',
			thickness: 0.2,
			height: 3
		});
		if (created.kind !== 'success') throw new Error(JSON.stringify(created.rejection));
		const base = created.document;
		const host = compileWallFirstLayoutGeometryFresh(base).geometry.walls[0]!;
		const plan = planCreateWallFirstOpening(
			base,
			{ wallId: host.wallId, kind: 'window', offset: host.length - 0.4 },
			sequentialCaptures('e4-i5-closed-seam')(),
			base.floor.id
		);
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		const compiled = compileWallFirstLayoutGeometryFresh(plan.document).geometry;
		const wall = compiled.walls[0]!;
		const opening = wall.openings[0]!;
		// The Opening's own span crosses the seam, so the accepted symbol is the
		// seam-split polyline the attempt must reproduce.
		expect(opening.centerPolyline.length).toBeGreaterThan(2);
		const accepted = openingPlanSymbol(opening, wall.thickness);
		const attempt = openingPlanSymbol(
			openingAttemptSymbolSource(wall, { kind: 'window', offset: opening.offset, width: opening.width }),
			wall.thickness
		);
		expect(attempt).toEqual(accepted);
	});

	it('an attempt overhanging its Wall is drawn at its raw position, never clamped', () => {
		const compiled = compileWallFirstLayoutGeometryFresh(singleWall({ kind: 'line' })).geometry;
		const wall = compiled.walls[0]!;
		const source = openingAttemptSymbolSource(wall, { kind: 'window', offset: CHORD - 0.5, width: 1.2 });
		expect(source.centerPolyline[0]![0]).toBeCloseTo(CHORD - 0.5, 9);
		expect(source.centerPolyline.at(-1)![0]).toBeCloseTo(CHORD + 0.7, 9);
		expect(source.center.point[0]).toBeCloseTo(CHORD + 0.1, 9);
		const before = openingAttemptSymbolSource(wall, { kind: 'door', offset: -0.4, width: 1 });
		expect(before.centerPolyline[0]![0]).toBeCloseTo(-0.4, 9);
		expect(before.center.point[0]).toBeCloseTo(0.1, 9);
	});
});
