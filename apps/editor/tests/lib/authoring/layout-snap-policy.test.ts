/**
 * R217.S14 — Layout's snap policy keeps one frame.
 *
 * The Opening-drag resolver matches a host Wall by its compiled `segmentId`,
 * which can be a sampled or room-qualified record. The offset it returns and
 * the point the mark paints must still be measured from the **authored** Wall
 * start/end: a record whose direction differs from the authored frame may
 * contribute its id and room, never a different origin.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planCreateWallFirstOpening,
	planWallChain,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { layoutSnapName, resolveOpeningSlideSnap } from '$lib/authoring/adapters/layout/snap';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const DRAFTING = { grid: true, snap: true, snapSuspended: false } as const;
const PIXELS_PER_METER = 100;

function fixture(): { document: LayoutDocumentWallFirst; wallId: string } {
	const base = createEmptyWallFirstLayoutDocument();
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0],
			[6, 4],
			[0, 4]
		],
		close: true,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the enclosure fixture was refused');
	const wallId = chained.document.walls[0]!.id;
	const opening = planCreateWallFirstOpening(
		chained.document,
		{ wallId, kind: 'window', offset: 1, width: 1.2, height: 1.2, sillHeight: 1 },
		freshCapture(),
		chained.document.floor.id
	);
	if (opening.kind === 'rejected') throw new Error(`opening fixture refused: ${opening.rejection.message}`);
	return { document: opening.document, wallId };
}

/** The authored start/end the adapter hands the resolver. */
function authoredSpan(
	document: LayoutDocumentWallFirst,
	wallId: string
): { readonly segmentId: string; readonly start: LayoutVec2; readonly end: LayoutVec2 } {
	const wall = document.walls.find((entry) => entry.id === wallId);
	if (wall === undefined) throw new Error('the fixture Wall is missing');
	const start = document.junctions.find((entry) => entry.id === wall.startJunctionId);
	const end = document.junctions.find((entry) => entry.id === wall.endJunctionId);
	if (start === undefined || end === undefined) throw new Error('the fixture Wall has no endpoints');
	return {
		segmentId: wall.id,
		start: [start.point[0], start.point[1]],
		end: [end.point[0], end.point[1]]
	};
}

/**
 * The compiled record for the same host, but room-qualified and written in the
 * opposite direction — the shape a sampled or legacy record can take.
 */
function reversedHostGeometry(geometry: CompiledLayoutGeometry, wallId: string): CompiledLayoutGeometry {
	return {
		...geometry,
		queries: {
			...geometry.queries,
			spans: geometry.queries.spans.map((span) =>
				span.kind === 'wall' && (span.segmentId === wallId || span.sourceId === wallId)
					? {
							...span,
							roomId: 'room-elsewhere',
							wallKey: `elsewhere:${span.wallKey ?? span.segmentId}`,
							start: span.end,
							end: span.start
						}
					: span
			)
		}
	};
}

describe('R217.S14 — Opening snap frame', () => {
	it('measures the winner and its offset from the authored Wall, not a room-qualified reversed span', () => {
		const { document, wallId } = fixture();
		const host = authoredSpan(document, wallId);
		const geometry = compileWallFirstLayoutGeometry(document).geometry;
		const compiledWall = geometry.queries.spans.find(
			(span) => span.kind === 'wall' && (span.segmentId === wallId || span.sourceId === wallId)
		);
		expect(compiledWall).toBeDefined();

		const resolution = resolveOpeningSlideSnap({
			geometry: reversedHostGeometry(geometry, wallId),
			hostSpan: host,
			// The fixture's other Opening sits at offset 1.0 with width 1.2, so a
			// centre at 1.6 lines its start edge up with that Opening's edge.
			openingId: 'opening-being-dragged',
			pointerCenterOffset: 1.6,
			width: 1.2,
			pixelsPerMeter: PIXELS_PER_METER,
			drafting: DRAFTING
		});

		expect(resolution.winner).not.toBeNull();
		expect(resolution.winner!.kind).toBe('opening-edge');
		expect(resolution.offset).toBeCloseTo(1, 6);
		const dx = host.end[0] - host.start[0];
		const dz = host.end[1] - host.start[1];
		const length = Math.hypot(dx, dz);
		expect(resolution.winner!.point[0]).toBeCloseTo(host.start[0] + (dx / length) * 1, 6);
		expect(resolution.winner!.point[1]).toBeCloseTo(host.start[1] + (dz / length) * 1, 6);
		// The reversed frame's mirror of offset 1 is at length - 1; a mark there
		// would not be the edge the committed offset targets.
		expect(resolution.winner!.point[0]).not.toBeCloseTo(host.start[0] + (dx / length) * (length - 1), 3);
	});
});

describe('R217.S14 — snap words', () => {
	it('names each family with one stable word and fails closed for an unknown kind', () => {
		expect(layoutSnapName('extension-guide')).toBe('Aligned');
		expect(layoutSnapName('wall-midpoint')).toBe('Wall');
		expect(layoutSnapName('object-bounds-center')).toBe('Object');
		expect(layoutSnapName('opening-edge')).toBe('Opening');
		expect(layoutSnapName('future-kind' as never)).toBe('Snap');
	});
});
