/**
 * P23.13 S10 / §9 — the keyboard control readout, driven directly (T2b, K3).
 *
 * The harvest's highest-priority gap: `planKeyboardControlReadout` had **zero
 * callers in tests**, so the one rule §9 states about value and units — the
 * readout names the focused control's *current* value and units, from the same
 * canonical facts the numeric door seeds from, and says nothing rather than a
 * fabricated zero — was pinned only by the source text that mentioned it.
 *
 * Everything below is driven by real `LayoutDocumentWallFirst` facts (the same
 * `planKeyboardControlFactsFromLayout` the viewport hands its live document to),
 * not by a second implementation living in the test.
 */
import { describe, expect, it } from 'vitest';
import {
	planKeyboardControlFactsFromLayout,
	planKeyboardControlReadout
} from '$lib/editor/layout/plan-keyboard-readout';
import { planTraversalAnnouncement } from '$lib/editor/layout/plan-keyboard-traversal';
import { deriveChainSpans } from '@portfolio/layout-core';
import { compileWallFirstLayoutGeometry } from '$lib/layout/layout-geometry';
import { createEmptyWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import type { LayoutDocumentWallFirst, LayoutVec2 } from '$lib/layout/layout-wall-first-types';

const JUNCTION_POINT: LayoutVec2 = [3.2, 1.4];
const KNOT_POINT: LayoutVec2 = [7.2, 3];
const OPENING_WIDTH = 0.9;
const OPENING_OFFSET = 1.2;

/** One straight Wall with a door, plus one curved Wall with an authored knot. */
function document(): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = [
		{ id: 'j-a', point: [...JUNCTION_POINT] as LayoutVec2 },
		{ id: 'j-b', point: [7.2, 1.4] },
		{ id: 'j-c', point: [7.2, 5.4] }
	];
	layout.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: { kind: 'line' }
		},
		{
			id: 'wall-curve',
			startJunctionId: 'j-b',
			endJunctionId: 'j-c',
			role: 'boundary',
			thickness: 0.2,
			height: 3,
			centerline: {
				kind: 'cubic-chain',
				knots: [{ id: 'knot-1', point: [...KNOT_POINT] as LayoutVec2 }],
				spans: deriveChainSpans([
					[7.2, 1.4],
					[...KNOT_POINT] as LayoutVec2,
					[7.2, 5.4]
				])
			}
		}
	];
	layout.openings = [
		{
			id: 'opening-1',
			wallId: 'wall-a',
			kind: 'door',
			offset: OPENING_OFFSET,
			width: OPENING_WIDTH,
			height: 2.1,
			profile: 'rectangular'
		}
	];
	return layout;
}

const facts = () => planKeyboardControlFactsFromLayout(document());

describe('P23.13 S10 keyboard readout (§9 value + units)', () => {
	it('reads a Junction as its document coordinate, in the door’s own units', () => {
		expect(
			planKeyboardControlReadout({ kind: 'junction', id: 'j-a', ownerId: 'wall-a' }, facts())
		).toBe('X 3.20 m, Z 1.40 m');
	});

	it('reads a curve control as the authored knot’s coordinate', () => {
		expect(
			planKeyboardControlReadout(
				{ kind: 'curve-control', id: 'knot-1', ownerId: 'wall-curve' },
				facts()
			)
		).toBe('X 7.20 m, Z 3.00 m');
	});

	it('reads the width edge as width and the slide grip as offset — never both', () => {
		// One control, one measure: they are the two fields of the same Opening
		// (§7), and the keyboard is speaking about the control the ring is on.
		const edge = planKeyboardControlReadout(
			{ kind: 'opening-edge', id: 'opening-1:start', ownerId: 'opening-1' },
			facts()
		);
		const slide = planKeyboardControlReadout(
			{ kind: 'opening-slide', id: 'opening-1:slide', ownerId: 'opening-1' },
			facts()
		);
		expect(edge).toBe('Width 0.90 m');
		expect(slide).toBe('Offset 1.20 m');
		expect(edge).not.toContain('Offset');
		expect(slide).not.toContain('Width');
	});

	it('answers null, not a fabricated zero, where the document holds no value', () => {
		for (const control of [
			// A legacy draft Junction has no canonical record.
			{ kind: 'junction', id: 'j-draft', ownerId: 'wall-a' } as const,
			// A knot no Wall owns.
			{ kind: 'curve-control', id: 'knot-elsewhere', ownerId: 'wall-curve' } as const,
			// An Opening the document does not hold.
			{ kind: 'opening-edge', id: 'opening-2:start', ownerId: 'opening-2' } as const,
			{ kind: 'opening-slide', id: 'opening-2:slide', ownerId: 'opening-2' } as const
		]) {
			expect(planKeyboardControlReadout(control, facts())).toBeNull();
		}
	});

	it('answers null for a document of another format, and for kinds with no measure', () => {
		const legacy = planKeyboardControlFactsFromLayout(null);
		expect(
			planKeyboardControlReadout({ kind: 'junction', id: 'j-a', ownerId: 'wall-a' }, legacy)
		).toBeNull();
		// The rotation arms are painted controls with no canonical scalar of their
		// own (S10's review follow-up): role and owner are announced without one.
		expect(
			planKeyboardControlReadout({ kind: 'room-rotation', id: 'r', ownerId: 'room-1' }, facts())
		).toBeNull();
		expect(
			planKeyboardControlReadout({ kind: 'object-rotation', id: 'o', ownerId: 'obj-1' }, facts())
		).toBeNull();
	});
});

describe('P23.13 S10 keyboard announcement composition (§9)', () => {
	it('names role, position, owner, value and units in one utterance', () => {
		const control = { kind: 'junction', id: 'j-a', ownerId: 'wall-a' } as const;
		const readout = planKeyboardControlReadout(control, facts());
		expect(planTraversalAnnouncement(control, 0, 2, 'Wall A', readout)).toBe(
			'Junction 1 of 2 — Wall A — X 3.20 m, Z 1.40 m'
		);
	});

	it('keeps the value clause out entirely when the control has no canonical value', () => {
		const control = { kind: 'junction', id: 'j-draft', ownerId: 'wall-a' } as const;
		const readout = planKeyboardControlReadout(control, facts());
		const announcement = planTraversalAnnouncement(control, 1, 2, 'Wall A', readout);
		expect(announcement).toBe('Junction 2 of 2 — Wall A');
		// No dangling separator and no invented measure: the only digits left are the
		// position the announcement always carries.
		expect(announcement).not.toContain('— Wall A —');
		expect(announcement).not.toContain(' m');
		expect(announcement.replace('2 of 2', '')).not.toMatch(/[0-9]/);
	});

	it('reads the same number the numeric door would seed for that fact', () => {
		// The door's own field labels and decimals are the authority; the readout is
		// a reading of them, so an Opening width edge says what the Width field shows.
		const edge = planKeyboardControlReadout(
			{ kind: 'opening-edge', id: 'opening-1:start', ownerId: 'opening-1' },
			facts()
		);
		expect(edge).toBe(`Width ${OPENING_WIDTH.toFixed(2)} m`);
	});
});

describe('P23.13 S10 readout facts come from the document, not a second copy', () => {
	it('resolves the same facts the compiled geometry holds', () => {
		const layout = document();
		const fromDocument = planKeyboardControlFactsFromLayout(layout);
		// The fixture is a real wall-first document: it compiles clean, so the ids the
		// readout resolves are ids the canonical compiler accepts too.
		expect(compileWallFirstLayoutGeometry(layout).issues).toEqual([]);
		expect(fromDocument.junctionPoint('j-a')).toEqual(JUNCTION_POINT);
		expect(fromDocument.curveKnotPoint('knot-1')).toEqual(KNOT_POINT);
		expect(fromDocument.opening('opening-1')).toEqual({
			width: OPENING_WIDTH,
			offset: OPENING_OFFSET
		});
	});

	it('is the only place the fact lookups live: the viewport delegates', () => {
		// The K3 gap was a readout rule no test could reach. It is reachable now
		// because the mapping *and* the wall-first lookups moved here; the component
		// keeps only "hand me the live document".
		const control = { kind: 'junction', id: 'j-a', ownerId: 'wall-a' } as const;
		expect(
			planKeyboardControlReadout(control, planKeyboardControlFactsFromLayout(document()))
		).toBe('X 3.20 m, Z 1.40 m');
	});
});
