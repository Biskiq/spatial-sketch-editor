import { describe, expect, it } from 'vitest';

import { createLayoutInteractionState } from '$lib/editor/layout/layout-interaction';
import {
	PLAN_DIMENSION_ARC_TAG,
	PLAN_DIMENSION_LANES_PX,
	PLAN_DIMENSION_SHORT_SPAN_PX,
	PLAN_DIMENSION_TEXT,
	createPlanDimensionMemory,
	derivePlanDimensions,
	placePlanDimensions,
	planDeltaText,
	planDimensionGestureKey,
	planDimensionPreferredSide,
	planDimensionText,
	planDimensionTextExtentPx,
	planSidesWithRoom,
	type PlanDimension,
	type PlanDimensionFacts
} from '$lib/editor/layout/plan-dimensions';
import {
	createPlanViewportState,
	worldToPlanScreen
} from '$lib/editor/layout/layout-plan-transform';

/**
 * P23.13 S6 — working dimensions (spec §7).
 *
 * §7 fixes the instrument: 0.75 px witnesses, 4 px slanted ticks, horizontal
 * 11 px mono text on a paper knockout, lanes at 18 px and 34 px, the side chosen
 * once per gesture, short spans pushing text outward and then to readout, and
 * "never scale text smaller". It fixes the *content* per context in its table,
 * and it says precision comes from the canonical value rather than the string —
 * which is why every value here is handed in, never measured by the module.
 */

const VIEW = {
	...createPlanViewportState(),
	width: 800,
	height: 600,
	center: [0, 0] as [number, number],
	pixelsPerMeter: 40,
	initialized: true
};

const p = (x: number, z: number): [number, number] => [x, z];

/** Facts with one straight wall, one curved wall and one Opening. */
function facts(overrides: Partial<PlanDimensionFacts> = {}): PlanDimensionFacts {
	return {
		wallLength: (wallKey) => (wallKey === 'w-straight' ? 4 : wallKey === 'w-curved' ? 7.24 : null),
		wallIsStraight: (wallKey) => wallKey !== 'w-curved',
		wallSpan: (wallKey) =>
			wallKey === 'w-straight'
				? ([p(0, 0), p(4, 0)] as const)
				: wallKey === 'w-curved'
					? ([p(0, 2), p(4, 2)] as const)
					: null,
		wallAnchor: (wallKey) => (wallKey === 'w-curved' ? p(2, 3) : null),
		opening: (wallKey, openingId) =>
			wallKey === 'w-straight' && openingId === 'o-1'
				? { width: 1, offset: 2.4, span: [p(2.4, 0), p(3.4, 0)] as const, anchor: p(2.9, 0), clearance: 0.8 }
				: null,
		...overrides
	};
}

function state(overrides: Partial<ReturnType<typeof createLayoutInteractionState>>) {
	return { ...createLayoutInteractionState(), planView: VIEW, ...overrides } as ReturnType<
		typeof createLayoutInteractionState
	>;
}

// ---------------------------------------------------------------------------
// The instrument itself (§7's numbers)
// ---------------------------------------------------------------------------

describe('P23.13 S6 dimension instrument — §7s numbers, one place', () => {
	it('uses §7s two lanes, tick length, stroke and typography', () => {
		expect(PLAN_DIMENSION_LANES_PX).toEqual({ first: 18, second: 34 });
		expect(PLAN_DIMENSION_TEXT.fontSizePx).toBe(11);
	});

	it('composes the drawn text and names the measure separately', () => {
		const bare: PlanDimension = {
			key: 'k',
			label: null,
			measure: 'Length',
			value: '4.00 m',
			span: null,
			anchor: [0, 0],
			lane: 1
		};
		// The geometry makes a bare length obvious; the readout cannot, so it
		// carries its own name.
		expect(planDimensionText(bare)).toBe('4.00 m');
		expect(planDimensionText({ ...bare, label: 'Width' })).toBe('Width 4.00 m');
		// §7: an arc is labelled as one, out loud.
		expect(planDimensionText({ ...bare, arc: true, value: '7.24 m' })).toBe(
			`${PLAN_DIMENSION_ARC_TAG} 7.24 m`
		);
		expect(planDeltaText([0.4, 0.86])).toBe('ΔX 0.40 m · ΔZ 0.86 m');
	});

	it('measures room the same way for every side policy', () => {
		const room = planSidesWithRoom({ minX: 100, minY: 40, maxX: 200, maxY: 90 }, VIEW);
		expect(room).toEqual({ abovePx: 40, belowPx: 510, leftPx: 100, rightPx: 600 });
		expect(planDimensionTextExtentPx('4.00 m').width).toBeGreaterThan(30);
	});
});

// ---------------------------------------------------------------------------
// Derivation per §7's context table
// ---------------------------------------------------------------------------

describe('P23.13 S6 derivation — §7s context table', () => {
	it('measures a live Wall leg as length plus angle', () => {
		const dimensions = derivePlanDimensions(
			state({ wallChainStart: p(0, 0), wallChainCursor: p(4, 0) }),
			facts()
		);
		expect(dimensions).toHaveLength(2);
		expect(dimensions[0]).toMatchObject({ lane: 1, value: '4.00 m', measure: 'Length' });
		expect(dimensions[1]).toMatchObject({ lane: 2, value: '0.0°', measure: 'Angle' });
		// The length measure brackets the leg being drawn.
		expect(dimensions[0]!.span).toEqual([p(0, 0), p(4, 0)]);
	});

	it('measures a Rectangle candidate as width and depth, both outside the face', () => {
		const dimensions = derivePlanDimensions(
			state({ rectangleStart: p(0, 0), rectangleCurrent: p(4, 2.5) }),
			facts()
		);
		expect(dimensions.map((dimension) => dimension.value)).toEqual(['4.00 m', '2.50 m']);
		// §7: "Width + depth; candidate enclosure" — each faces away from the
		// candidate's own centre, so neither reads as the room's outline.
		for (const dimension of dimensions) {
			expect(dimension.outward).toEqual([2, 1.25]);
		}
	});

	it('measures an Opening drag as width plus offset and clearance', () => {
		const dimensions = derivePlanDimensions(
			state({
				wallOpeningDrag: {
					mode: 'body',
					wallId: 'w-straight',
					openingId: 'o-1',
					baselineOffset: 1,
					baselineWidth: 1,
					wallLength: 4,
					rawPointerOffset: 2.4,
					candidateOffset: 2.4,
					candidateWidth: 1,
					snapped: false,
					valid: true
				}
			}),
			facts()
		);
		expect(dimensions[0]).toMatchObject({ lane: 1, label: 'Width', value: '1.00 m' });
		expect(dimensions[1]).toMatchObject({
			lane: 2,
			measure: 'Offset',
			value: 'Offset 2.40 m · clearance 0.80 m'
		});
	});

	it('drops the offset from a resize and keeps the clearance it is changing', () => {
		const dimensions = derivePlanDimensions(
			state({
				wallOpeningDrag: {
					mode: 'end-edge',
					wallId: 'w-straight',
					openingId: 'o-1',
					baselineOffset: 1,
					baselineWidth: 1,
					wallLength: 4,
					rawPointerOffset: 2.4,
					candidateOffset: 2.4,
					candidateWidth: 1.6,
					snapped: false,
					valid: true
				}
			}),
			facts()
		);
		expect(dimensions[0]).toMatchObject({ value: '1.60 m' });
		expect(dimensions[1]!.value).toBe('clearance 0.80 m');
		expect(dimensions[1]!.value).not.toContain('Offset');
	});

	it('omits a measure whose canonical value is unknown instead of estimating it', () => {
		// A missing fact is not a licence to measure the chord.
		const dimensions = derivePlanDimensions(
			state({ selection: { kind: 'physicalWall', wallId: 'w-unknown' } }),
			facts()
		);
		expect(dimensions).toEqual([]);
	});

	it('reports deltas for a Junction move and the baseline length for a Wall move', () => {
		const junction = derivePlanDimensions(
			state({
				architectureEdit: {
					kind: 'junction-move',
					pointerId: 1,
					junctionId: 'j-1',
					startPointer: p(0, 0),
					baselinePoint: p(0, 0),
					junctionExcludePoints: [],
					affectedWallIds: [],
					candidatePoint: p(0.4, 0.86),
					valid: true
				}
			}),
			facts()
		);
		expect(junction).toHaveLength(1);
		expect(junction[0]!.value).toBe('ΔX 0.40 m · ΔZ 0.86 m');

		const wall = derivePlanDimensions(
			state({
				architectureEdit: {
					kind: 'wall-move',
					pointerId: 1,
					wallId: 'w-straight',
					startPointer: p(0, 0),
					baselineGrabPoint: p(1, 0),
					startJunctionId: 'j-1',
					endJunctionId: 'j-2',
					baselineStart: p(0, 0),
					baselineEnd: p(4, 0),
					affectedWallIds: [],
					candidateDelta: [0, 0.86],
					valid: true
				}
			}),
			facts()
		);
		// §7: "ΔX / ΔZ; baseline" — the delta plus the extent that is moving.
		expect(wall[0]!.value).toBe('ΔX 0.00 m · ΔZ 0.86 m');
		expect(wall[1]).toMatchObject({ lane: 2, measure: 'Length', value: '4.00 m' });
	});

	it('measures a bend as the arc, never the chord (§7 explicit `arc`)', () => {
		const dimensions = derivePlanDimensions(
			state({
				architectureEdit: {
					kind: 'curve-control-move',
					pointerId: 1,
					wallId: 'w-curved',
					anchorId: 'a-1',
					startPointer: p(0, 0),
					baselineAnchorPoint: p(2, 3),
					curveExcludePoints: [],
					affectedWallIds: ['w-curved'],
					candidatePoint: p(2, 3.4),
					valid: true
				}
			}),
			facts()
		);
		// 7.24 is the canonical arc length. The chord between the compiled ends
		// (0,2)→(4,2) would be 4.00 — reporting that would be a lie about the wall.
		expect(dimensions[0]).toMatchObject({ value: '7.24 m', measure: 'Arc length', arc: true });
		expect(dimensions[0]!.value).not.toBe('4.00 m');
	});

	it('shows one primary measure for a selected Wall, arc-tagged only when curved', () => {
		const straight = derivePlanDimensions(
			state({ selection: { kind: 'physicalWall', wallId: 'w-straight' } }),
			facts()
		);
		expect(straight).toHaveLength(1);
		expect(straight[0]).toMatchObject({ value: '4.00 m', arc: false });
		expect(planDimensionText(straight[0]!)).toBe('4.00 m');

		const curved = derivePlanDimensions(
			state({ selection: { kind: 'physicalWall', wallId: 'w-curved' } }),
			facts()
		);
		expect(curved[0]).toMatchObject({ value: '7.24 m', arc: true });
		expect(planDimensionText(curved[0]!)).toBe('Arc 7.24 m');
	});

	it('shows width alone for a selected Opening, offset only once focused', () => {
		const resting = derivePlanDimensions(
			state({ selection: { kind: 'wallOpening', wallId: 'w-straight', openingId: 'o-1' } }),
			facts()
		);
		expect(resting).toHaveLength(1);
		expect(resting[0]).toMatchObject({ label: 'Width', value: '1.00 m' });

		const focused = derivePlanDimensions(
			state({
				selection: { kind: 'wallOpening', wallId: 'w-straight', openingId: 'o-1' },
				planFocus: { kind: 'opening-edge', id: 'o-1#start', ownerId: 'o-1' }
			}),
			facts()
		);
		expect(focused.map((dimension) => dimension.measure)).toEqual(['Width', 'Offset']);
	});

	it('draws no dimension chain for a selected Room (§7)', () => {
		// The old per-edge labels are *replaced*, not restyled: a selected Room
		// keeps the S3 identity stack (name/reference/area) and no chain.
		const dimensions = derivePlanDimensions(
			state({ selection: { kind: 'room', roomId: 'r-1' } }),
			facts()
		);
		expect(dimensions).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Placement: lanes, freeze, push-out, readout
// ---------------------------------------------------------------------------

describe('P23.13 S6 placement — lanes, freeze, push-out, readout', () => {
	const legDimensions = derivePlanDimensions(
		state({ wallChainStart: p(-3, 0), wallChainCursor: p(3, 0) }),
		facts()
	);

	it('places lane 1 at 18 px and lane 2 at 34 px from the measured span', () => {
		const outcome = placePlanDimensions(legDimensions, VIEW, { side: 'negative' });
		const [laneOne, laneTwo] = outcome.placed;
		const spanScreen = 6 * VIEW.pixelsPerMeter;
		// A horizontal span's normal is vertical, so the lane offset is a y offset.
		expect(Math.abs(laneOne!.line![0][1] - VIEW.height / 2)).toBeCloseTo(
			PLAN_DIMENSION_LANES_PX.first,
			6
		);
		// Lane 2 is measured from the band too, not stacked on lane 1.
		expect(Math.abs(laneTwo!.text[1] - VIEW.height / 2)).toBeCloseTo(
			PLAN_DIMENSION_LANES_PX.second,
			6
		);
		expect(laneOne!.line![1][0] - laneOne!.line![0][0]).toBeCloseTo(spanScreen, 6);
		// Witnesses run from the measured ends out to the line, and the 4 px
		// ticks straddle it — §7's 0.75 px witnesses and slanted ends.
		expect(laneOne!.witnesses).toHaveLength(2);
		expect(laneOne!.ticks).toHaveLength(2);
		const tick = laneOne!.ticks[0]!;
		expect(Math.hypot(tick[1][0] - tick[0][0], tick[1][1] - tick[0][1])).toBeCloseTo(4, 6);
	});

	it('freezes the chosen side for the gesture and re-decides for the next one', () => {
		// §7: "Choose the side with more space once at gesture start; freeze it
		// until end." Pan far enough that a fresh choice would flip the lane, and
		// the frozen band must not follow it under the pointer.
		const gesture = state({ wallChainStart: p(-3, 0), wallChainCursor: p(3, 0) });
		const key = planDimensionGestureKey(gesture);
		const memory = createPlanDimensionMemory();
		const first = placePlanDimensions(legDimensions, VIEW, { memory, gestureKey: key });
		expect(first.placed[0]!.side).toBe('negative');
		const panned = { ...VIEW, center: [0, 7] as [number, number] };
		// A fresh chooser at the panned view would take the other side...
		expect(planDimensionPreferredSide([p(-3, 0), p(3, 0)] as never, panned)).toBe('positive');
		// ...and the frozen one does not.
		const afterPan = placePlanDimensions(legDimensions, panned, { memory, gestureKey: key });
		expect(afterPan.placed[0]!.side).toBe('negative');
		// The freeze moved the lane with the view; it did not change the measure.
		expect(afterPan.placed[0]!.line![0][1] - first.placed[0]!.line![0][1]).toBe(
			-7 * panned.pixelsPerMeter
		);
		// Without the memory the same input decides freshly, which is what makes
		// the assertion above about the memory rather than about the geometry.
		expect(placePlanDimensions(legDimensions, panned).placed[0]!.side).toBe('positive');
		// A new gesture (another leg) is a new decision — and it starts from a
		// clean slate: the previous gesture's answer must not survive into it,
		// which is both §7 (one decision per gesture) and how the memory stays
		// bounded over a session.
		const nextKey = planDimensionGestureKey(
			state({ wallChainStart: p(6, 0), wallChainCursor: p(9, 0) })
		);
		expect(nextKey).not.toBe(key);
		const nextGesture = placePlanDimensions(legDimensions, panned, {
			memory,
			gestureKey: nextKey
		});
		expect(nextGesture.placed[0]!.side).toBe('positive');
		expect(planDimensionGestureKey(state({ selection: { kind: 'none' } }))).toBe('idle');
	});

	it('pushes a short span text outward instead of shrinking it (§7)', () => {
		// A 0.2 m leg at 40 px/m is 8 px — far below §7s 40 px short-span floor.
		const shortLeg = derivePlanDimensions(
			state({ wallChainStart: p(0, 0), wallChainCursor: p(0.2, 0) }),
			facts()
		);
		const outcome = placePlanDimensions(shortLeg, VIEW, { side: 'negative' });
		const length = outcome.placed.find((placement) => placement.key === 'leg:length')!;
		expect(length.pushedOut).toBe(true);
		const centre = (length.line![0][0] + length.line![1][0]) / 2;
		expect(length.text[0]).not.toBeCloseTo(centre, 3);
		// The text keeps its size: §7 forbids scaling it down to fit.
		expect(PLAN_DIMENSION_SHORT_SPAN_PX).toBe(40);
		expect(planDimensionTextExtentPx(lengthLengthText(shortLeg)).width).toBeGreaterThan(8);
	});

	it('draws nothing for a measure whose geometry is off the canvas, and reports nothing', () => {
		// A panned-away wall is not an unreadable measurement: everything about it
		// is off-screen, so a readout entry would be noise pretending to be a
		// fallback.
		const farAway = { ...VIEW, center: [-1000, 0] as [number, number] };
		const outcome = placePlanDimensions(legDimensions, farAway, { side: 'negative' });
		expect(outcome.placed).toEqual([]);
		expect(outcome.readout).toEqual([]);
	});

	it('moves a pushed-out measure that still cannot fit to the readout, with its name', () => {
		// §7 pushes a short span's text outward *before* giving up on it, so the
		// readout has to be reached the hard way: a canvas narrow enough that
		// neither end of the span has room for the text.
		const narrow = { ...VIEW, width: 60 };
		const shortLeg = derivePlanDimensions(
			state({ wallChainStart: p(0, 0), wallChainCursor: p(0.2, 0) }),
			facts()
		);
		const outcome = placePlanDimensions(shortLeg, narrow, { side: 'negative' });
		const length = outcome.placed.find((placement) => placement.key === 'leg:length');
		expect(length).toBeUndefined();
		const entry = outcome.readout.find((candidate) => candidate.key === 'leg:length')!;
		// Detached from the geometry, the entry must say what it measured.
		expect(entry.measure).toBe('Length');
		expect(entry.value).toBe('0.20 m');
	});

	it('pushes a short span toward the roomier end, not off the paper', () => {
		// The same short span nudged against the right edge: pushing it further
		// right would leave the canvas, so the roomier direction wins and the
		// number stays on the paper. Readout is for what cannot be placed either
		// way, not for whatever points at the nearest edge.
		const rightEdge = derivePlanDimensions(
			state({ wallChainStart: p(9.9, 0), wallChainCursor: p(10.1, 0) }),
			facts()
		);
		const outcome = placePlanDimensions(rightEdge, VIEW, { side: 'negative' });
		const length = outcome.placed.find((placement) => placement.key === 'leg:length')!;
		expect(length.pushedOut).toBe(true);
		// The length is the measure under test: it is pushed out and drawn, never
		// reported. The leg's lane-2 angle *does* report here, and honestly so —
		// the span sits on the right hand edge, so a centred 40 px string has
		// nowhere on the paper to sit, whatever side of the band it takes.
		expect(outcome.readout.map((entry) => entry.key)).toEqual(['leg:angle']);
		expect(outcome.readout[0]!.measure).toBe('Angle');
		const extent = planDimensionTextExtentPx(planDimensionText(rightEdge[0]!));
		expect(length.text[0] + extent.width / 2).toBeLessThanOrEqual(VIEW.width);
	});

	it('stacks the second lane on the band 34 px from it, not across the band', () => {
		// §7 fixes two lanes offset from the band: 18 px, then a second at 34 px
		// `when necessary`. A leg's angle has no extent of its own, so if it chose
		// its own side it would land on the far side of the band from the length it
		// belongs to — two numbers straddling the geometry instead of one lane pair.
		const outcome = placePlanDimensions(legDimensions, VIEW);
		const [length, angle] = outcome.placed;
		const bandY = VIEW.height / 2;
		expect(length!.side).toBe(angle!.side);
		expect(Math.abs(length!.line![0][1] - bandY)).toBeCloseTo(
			PLAN_DIMENSION_LANES_PX.first,
			6
		);
		expect(Math.abs(angle!.text[1] - bandY)).toBeCloseTo(PLAN_DIMENSION_LANES_PX.second, 6);
		expect(Math.sign(angle!.text[1] - bandY)).toBe(Math.sign(length!.line![0][1] - bandY));
		// The angle keeps the band's own mid-lane: only its lane offset moved it.
		expect(angle!.text[0]).toBeCloseTo(length!.text[0], 6);
	});

	it('offsets a band-less measure along the band normal, not always vertically', () => {
		// A vertical leg's lanes leave sideways. The angle must follow the band it
		// measures rather than take a vertical lane of its own, or it would sit on
		// the leg's axis — the one place a lane must never be.
		const vertical = derivePlanDimensions(
			state({ wallChainStart: p(-3, -3), wallChainCursor: p(-3, 3) }),
			facts()
		);
		const outcome = placePlanDimensions(vertical, VIEW);
		const [length, angle] = outcome.placed;
		const bandX = worldToPlanScreen(VIEW, p(-3, 0))[0];
		expect(Math.abs(angle!.text[0] - bandX)).toBeCloseTo(PLAN_DIMENSION_LANES_PX.second, 6);
		expect(angle!.text[1]).toBeCloseTo(length!.text[1], 6);
	});

	it('puts a measure with no band at all on the roomier side of its locus', () => {
		// A junction delta has no extent anywhere in its set, so there is no band to
		// offset from: the lane is vertical and §7's one rule — the side with more
		// space — decides it, measured from the locus.
		const highOnPaper = derivePlanDimensions(
			state({
				architectureEdit: {
					kind: 'junction-move',
					pointerId: 1,
					junctionId: 'j-1',
					startPointer: p(0, -7),
					baselinePoint: p(0, -7),
					junctionExcludePoints: [],
					affectedWallIds: [],
					candidatePoint: p(0.4, -6.6),
					valid: true
				}
			}),
			facts()
		);
		const anchorY = worldToPlanScreen(VIEW, p(0.4, -6.6))[1];
		expect(anchorY).toBeLessThan(VIEW.height / 2);
		const outcome = placePlanDimensions(highOnPaper, VIEW);
		expect(outcome.placed[0]!.side).toBe('positive');
		expect(outcome.placed[0]!.text[1]).toBeGreaterThan(anchorY);
		expect(outcome.readout).toEqual([]);
	});

	it('mirrors a second lane that its own side has run out of paper for', () => {
		// The freeze holds the lane's *side* for the whole gesture, but the paper
		// under it can change: a leg pinned near the top edge has 18 px of room for
		// lane 1 on the frozen side and 34 px of room for none. The mirror of a lane
		// is still that measure's lane, so the angle is drawn — 16 px further out,
		// on the other side — instead of being reported for want of room.
		// 26 px below the top edge: the band sits at screen y = 26 at this scale.
		const nearTop = derivePlanDimensions(
			state({ wallChainStart: p(0, -6.85), wallChainCursor: p(3, -6.85) }),
			facts()
		);
		const outcome = placePlanDimensions(nearTop, VIEW, { side: 'negative' });
		const [length, angle] = outcome.placed;
		expect(length!.side).toBe('negative');
		expect(length!.line![0][1]).toBeCloseTo(26 - PLAN_DIMENSION_LANES_PX.first, 6);
		// Whatever lane the mirror landed on, the number is on the paper and named
		// for what it measures — never a silent drop.
		expect(angle!.text[1]).toBeCloseTo(26 + PLAN_DIMENSION_LANES_PX.second, 6);
		expect(angle!.side).toBe('positive');
		expect(outcome.readout).toEqual([]);
	});

	it('reports a band-less measure whose text fits on neither side', () => {
		// The readout is the last resort and stays one: a locus hard against the
		// left edge cannot hold a 10-character delta on either vertical side, so
		// the measure reports itself rather than drawing a clipped string.
		const narrow = { ...VIEW, width: 60 };
		const delta = derivePlanDimensions(
			state({
				architectureEdit: {
					kind: 'junction-move',
					pointerId: 1,
					junctionId: 'j-1',
					startPointer: p(0, 0),
					baselinePoint: p(0, 0),
					junctionExcludePoints: [],
					affectedWallIds: [],
					candidatePoint: p(0.4, 0.86),
					valid: true
				}
			}),
			facts()
		);
		const outcome = placePlanDimensions(delta, narrow);
		expect(outcome.placed).toEqual([]);
		expect(outcome.readout[0]).toMatchObject({ key: 'delta', measure: 'ΔX / ΔZ' });
	});

	it('keeps a span-less measure in its lane beside the locus', () => {
		const bend = derivePlanDimensions(
			state({
				architectureEdit: {
					kind: 'curve-control-move',
					pointerId: 1,
					wallId: 'w-curved',
					anchorId: 'a-1',
					startPointer: p(0, 0),
					baselineAnchorPoint: p(2, 3),
					curveExcludePoints: [],
					affectedWallIds: ['w-curved'],
					candidatePoint: p(2, 3.4),
					valid: true
				}
			}),
			facts()
		);
		const outcome = placePlanDimensions(bend, VIEW, { side: 'negative' });
		// An arc read off a curve has no extent to witness, so it draws no line —
		// a dimension line there would claim the arc spans those two points.
		expect(outcome.placed[0]!.line).toBeNull();
		expect(outcome.placed[0]!.witnesses).toEqual([]);
	});

	it('prefers the side away from the owner, then the side with more room', () => {
		// `negative` is the `perp(d)` side — screen-up for a left-to-right span —
		// and `positive` is the mirror. Whatever the preference, §7s "side with
		// more space" still wins, so a preference cannot push a lane off the paper.
		const middleSpan: [number, number][] = [p(-2, 0), p(2, 0)];
		// Owner above the span: the lane faces down, where the room is.
		expect(planDimensionPreferredSide(middleSpan as never, VIEW, p(0, -1))).toBe('positive');
		// Owner below the span: the lane faces up.
		expect(planDimensionPreferredSide(middleSpan as never, VIEW, p(0, 1))).toBe('negative');
		// Span at the very top of the canvas with its owner below: the outward
		// preference would put the lane above the paper, so the room wins instead.
		const topSpan: [number, number][] = [p(-2, -7.4), p(2, -7.4)];
		expect(planDimensionPreferredSide(topSpan as never, VIEW, p(0, -7))).toBe('positive');
		// No owner to face away from: the upper lane is preferred.
		expect(planDimensionPreferredSide(middleSpan as never, VIEW)).toBe('negative');
	});

	it('gives a Rectangle two lanes on two different normals', () => {
		const dimensions = derivePlanDimensions(
			state({ rectangleStart: p(0, 0), rectangleCurrent: p(4, 2.5) }),
			facts()
		);
		const outcome = placePlanDimensions(dimensions, VIEW);
		expect(outcome.placed).toHaveLength(2);
		const [width, depth] = outcome.placed;
		// One lane is horizontal, the other vertical: two faces, not two offsets
		// of the same edge.
		expect(width!.line![0][1]).toBeCloseTo(width!.line![1][1], 6);
		expect(depth!.line![0][0]).toBeCloseTo(depth!.line![1][0], 6);
	});
});

function lengthLengthText(dimensions: readonly PlanDimension[]): string {
	return planDimensionText(dimensions.find((dimension) => dimension.measure === 'Length')!);
}
