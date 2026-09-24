/**
 * P23B.3a S6 (review correction) — the ONE click-to-declaration rule.
 *
 * Independent Walls may legally overlap, so a coordinate can sit on the span of
 * more than one Wall at once. The geometry-only fallback must never choose the
 * first of them: ambiguity declares NOTHING. A click that resolved through the
 * canonical snap layer is different — that layer names a specific, deterministic
 * winner, and that identified host may be declared, but only after the point is
 * validated against the named Wall.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core';

import {
	declaredHostWallAtSpan,
	layoutClickAnchorDeclaration,
	layoutPointAnchorDeclaration
} from '$lib/editor/layout/layout-click-declaration';

function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

/**
 * Two INDEPENDENT Walls crossing at the origin: a horizontal Wall (top → bottom
 * of the crossing) and a vertical one. They share no Junction, so the crossing is
 * permitted, un-noded overlap (S4/S5) and BOTH spans carry the origin.
 */
function crossingBaseline(): { document: LayoutDocumentWallFirst; horizontal: string; vertical: string } {
	const horizontal = planWallChain({
		baseline: baseDocument(),
		points: [
			[-2, 0],
			[2, 0]
		],
		close: false,
		role: 'partition'
	});
	if (horizontal.kind !== 'success') throw new Error('horizontal failed');
	const vertical = planWallChain({
		baseline: horizontal.document,
		points: [
			[0, -2],
			[0, 2]
		],
		close: false,
		role: 'partition'
	});
	if (vertical.kind !== 'success') throw new Error('vertical failed');
	return {
		document: vertical.document,
		horizontal: horizontal.createdWallIds[0]!,
		vertical: vertical.createdWallIds[0]!
	};
}

function wallSpanSnap(wallId: string, point: [number, number]) {
	return {
		point,
		resolution: {
			kind: 'snap' as const,
			candidate: {
				point,
				kind: 'wall-span' as const,
				sourceId: `${wallId}#span`,
				wallId,
				distance: 0
			},
			guides: []
		}
	};
}

describe('P23B.3a S6 click declaration — geometry-only fallback is conservative', () => {
	it('declares the host when exactly one Wall span carries the point', () => {
		const { document, horizontal } = crossingBaseline();
		expect(declaredHostWallAtSpan(document, [1, 0])).toBe(horizontal);
	});

	it('declares NOTHING when several independent Wall spans carry the point', () => {
		const { document } = crossingBaseline();
		// Two independent Walls overlap at the origin; record order is not a
		// statement about which group the operation extends.
		expect(declaredHostWallAtSpan(document, [0, 0])).toBeNull();
		expect(layoutPointAnchorDeclaration(document, [0, 0])).toEqual({});
	});
});

describe('P23B.3a S6 click declaration — a validated snap winner may declare', () => {
	it('declares the specifically identified winner even where the geometry alone is ambiguous', () => {
		const { document, vertical } = crossingBaseline();
		expect(layoutClickAnchorDeclaration(document, wallSpanSnap(vertical, [0, 0]))).toEqual({
			hostWallId: vertical
		});
	});

	it('declares nothing when the named Wall is not in the document', () => {
		const { document } = crossingBaseline();
		expect(layoutClickAnchorDeclaration(document, wallSpanSnap('no-such-wall', [0, 0]))).toEqual({});
	});

	it('declares nothing when the point does not lie on the named Wall', () => {
		const { document, vertical } = crossingBaseline();
		expect(layoutClickAnchorDeclaration(document, wallSpanSnap(vertical, [5, 5]))).toEqual({});
	});

	it('declares nothing for a non-snap resolution', () => {
		const { document } = crossingBaseline();
		expect(layoutClickAnchorDeclaration(document, { point: [0, 0], resolution: { kind: 'none' } })).toEqual({});
	});
});
