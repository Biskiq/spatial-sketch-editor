/**
 * `plan-dimensions.ts` — P23.13 S6: the transient dimension set.
 *
 * Spec §7: "Dimensions are **working information**, never authored annotations.
 * Use 0.75 px witnesses, 4 px slanted ticks and horizontal 11 px mono text on a
 * small paper knockout. Offset from the band by 18 px; reserve a second lane at
 * 34 px when necessary. Choose the side with more space once at gesture start;
 * freeze it until end. Short spans push text outward, then to readout; never
 * scale text smaller. Display meters and degrees explicitly; actual precision
 * comes from the canonical value, not its formatted string."
 *
 * Four separations this module is built on:
 *
 * 1. **Derived, never authored.** A dimension is a projection of the live
 *    gesture plus canonical measurements. Nothing here is stored, nothing is
 *    persisted, and no dimension is ever an input to a planner — passive
 *    clearance and area stay working information (§7).
 * 2. **Canonical values, bounded display.** Every number comes from the source
 *    that already owns it (the compiled arc length of a Wall, the authored
 *    Opening width); only the *string* is rounded. A curved host is never
 *    measured as a chord: an arc is asked for its arc length and the text says
 *    `Arc` out loud, which is the difference between a measurement and a
 *    fabrication.
 * 3. **Placement is policy, not measurement.** Lanes, the side, the freeze and
 *    the push-out/readout fallback change *where* a number is drawn. None of
 *    them can change what it says, and none of them may shrink the text (§7:
 *    "never scale text smaller").
 * 4. **The readout names itself.** Once a measure leaves the geometry it is
 *    detached from what it measured, so a readout entry always carries its own
 *    name; the drawn text stays bare where the geometry makes it obvious.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import { formatDegrees, formatMeters } from './layout-exact-input';
import { worldToPlanScreen, type PlanViewportState } from './layout-plan-transform';
import type { LayoutArchitectureEditGesture, LayoutInteractionState } from './layout-interaction';

/** Spec §7's two lanes, measured from the band edge in CSS px. */
export const PLAN_DIMENSION_LANES_PX = { first: 18, second: 34 } as const;
/** Spec §7: 0.75 px witnesses, drawn in the secondary ink (`--editor-plan-muted`). */
export const PLAN_DIMENSION_WITNESS_STROKE_PX = 0.75;
/** Spec §7: 4 px slanted end ticks. */
export const PLAN_DIMENSION_TICK_LENGTH_PX = 4;
/**
 * Spec §7's typography — horizontal 11 px mono on a small paper knockout. Owned
 * here so placement can weigh the text it is about to draw; the paint layer
 * mirrors these numbers in `.dimension-label`.
 */
export const PLAN_DIMENSION_TEXT = { fontSizePx: 11, lineHeightPx: 13, advanceRatio: 0.6 } as const;
/** §7 requires an arc to be labelled as one ("label explicitly `arc`"). */
export const PLAN_DIMENSION_ARC_TAG = 'Arc';
/** Breathing room between the text box and the span it measures. */
export const PLAN_DIMENSION_TEXT_PAD_PX = 6;
/** Below this screen span the measure counts as short and pushes its text out. */
export const PLAN_DIMENSION_SHORT_SPAN_PX = 40;
/**
 * The editor's own "this is not a Wall" threshold, mirrored from the chain-draft
 * validity rule (`layout-interaction.ts`) so a leg this module declines to
 * measure is exactly the one the planner refuses to commit.
 */
export const PLAN_DIMENSION_DEGENERATE_EPSILON = 1e-6;
/** The text keeps this much clear of the canvas edge before it moves to readout. */
export const PLAN_DIMENSION_INSET_PX = 4;
/** A readout that grows without bound stops being a readout. */
export const PLAN_DIMENSION_MAX_READOUT = 2;

/**
 * One derived measurement. `span` is what the witnesses bracket; a measure with
 * no extent (a delta, a coordinate, an arc read off a curve) has `span: null`
 * and is drawn as text placed by its lane, because drawing a dimension line for
 * it would claim an extent the number does not have.
 */
export type PlanDimension = {
	key: string;
	/** Drawn prefix, when the value needs one next to the geometry. */
	label: string | null;
	/** What the readout calls it once it is detached from the geometry. */
	measure: string;
	/** Canonical display value, already formatted with its unit. */
	value: string;
	span: readonly [LayoutVec2, LayoutVec2] | null;
	/** Locus a span-less measure sits at (the moving point, the focused handle). */
	anchor: LayoutVec2;
	lane: 1 | 2;
	/** The canonical value is an arc length; the text says so (§7). */
	arc?: boolean;
	/**
	 * World point the lane faces *away* from (an owner centroid), so a Room's
	 * dimensions land outside the face they measure instead of across it.
	 * Absent means the upper lane is preferred.
	 */
	outward?: LayoutVec2;
};

/** Canonical Opening facts a width/offset/clearance measure needs. */
export type PlanDimensionOpeningFacts = {
	width: number;
	offset: number;
	/** The two jambs (the width-edge span), or `null` when unknown. */
	span: readonly [LayoutVec2, LayoutVec2] | null;
	/** Locus for span-less measures (the Opening centre). */
	anchor: LayoutVec2;
	/** Nearest clearance to a host end or a neighbouring Opening, in meters. */
	clearance: number | null;
};

/**
 * The canonical numeric truth the derivation may read, implemented by the
 * caller from the compiled model. Deliberately small: everything the derivation
 * can know from the interaction state alone it computes itself, so this seam
 * carries only what only the model knows — and every method may answer `null`,
 * which omits a measure rather than approximating it.
 */
export type PlanDimensionFacts = {
	/** Canonical arc length of a Wall, straight or curved. */
	wallLength: (wallKey: string) => number | null;
	/** False for a curved Wall: its compiled extent is not its length. */
	wallIsStraight: (wallKey: string) => boolean;
	/**
	 * The two ends a witness line may bracket, or `null` when the host is not
	 * straight — a curved Wall's own start/end is its *chord*, and bracketing it
	 * would publish a shorter wall than the one that exists.
	 */
	wallSpan: (wallKey: string) => readonly [LayoutVec2, LayoutVec2] | null;
	/**
	 * Where a span-less length measure sits (a curved host's mid-arc point).
	 * Placement only: the *value* still comes from `wallLength`.
	 */
	wallAnchor: (wallKey: string) => LayoutVec2 | null;
	opening: (wallKey: string, openingId: string) => PlanDimensionOpeningFacts | null;
};

export type PlanDimensionSide = 'positive' | 'negative';

export type PlanDimensionPlacement = {
	key: string;
	lane: 1 | 2;
	side: PlanDimensionSide;
	/** Witness stubs from the measured ends out to the dimension line. */
	witnesses: readonly (readonly [LayoutVec2, LayoutVec2])[];
	/** The dimension line, when the measure has an extent. */
	line: readonly [LayoutVec2, LayoutVec2] | null;
	/** §7's 4 px slanted end ticks, one per measured end. */
	ticks: readonly (readonly [LayoutVec2, LayoutVec2])[];
	/** Text anchor in screen space (baseline-centred on the line). */
	text: LayoutVec2;
	/** True when a short span pushed the text outward instead of centring it. */
	pushedOut: boolean;
};

export type PlanDimensionReadoutEntry = { key: string; measure: string; value: string };

export type PlanDimensionOutcome = {
	/** What is drawn on the canvas. */
	placed: readonly PlanDimensionPlacement[];
	/** §7: what will not fit locally moves here instead of being shrunk. */
	readout: readonly PlanDimensionReadoutEntry[];
};

/**
 * The frozen side decision, one per gesture (§7: "choose the side with more
 * space once at gesture start; freeze it until end"). Keyed by the gesture, not
 * by the frame, and never document state — the same shape as the salience
 * hysteresis memory.
 */
export type PlanDimensionMemory = {
	/**
	 * The frozen side for one gesture-measure. A new `gestureKey` is a new
	 * decision *and* discards the previous gesture's, so the memory holds exactly
	 * one gesture's worth of answers: it cannot leak a side across gestures, and
	 * it cannot grow without bound over a session.
	 */
	sideFor: (
		gestureKey: string,
		dimensionKey: string,
		choose: () => PlanDimensionSide
	) => PlanDimensionSide;
};

export function createPlanDimensionMemory(): PlanDimensionMemory {
	let gesture: string | null = null;
	let sides = new Map<string, PlanDimensionSide>();
	return {
		sideFor(gestureKey, dimensionKey, choose) {
			if (gesture !== gestureKey) {
				gesture = gestureKey;
				sides = new Map();
			}
			const known = sides.get(dimensionKey);
			if (known !== undefined) return known;
			const chosen = choose();
			sides.set(dimensionKey, chosen);
			return chosen;
		}
	};
}

/**
 * Identity of the gesture a dimension belongs to. §7 freezes the side "until
 * end", so the key must change exactly when a new gesture starts and must be
 * stable for every frame of the current one — a fresh wall-chain leg is a new
 * gesture, a pointermove is not.
 */
export function planDimensionGestureKey(interaction: LayoutInteractionState): string {
	const edit = interaction.architectureEdit;
	if (edit) {
		const owner = 'wallId' in edit ? edit.wallId : 'junctionId' in edit ? edit.junctionId : 'unknown';
		return `edit:${edit.kind}:${owner}`;
	}
	const opening = interaction.wallOpeningDrag;
	if (opening) return `opening:${opening.openingId}:${opening.mode}`;
	if (interaction.rectangleStart && interaction.rectangleCurrent) return 'rect';
	const leg = interaction.wallChainStart;
	if (leg && interaction.wallChainCursor) return `leg:${leg[0]},${leg[1]}`;
	const room = interaction.roomUnitDrag;
	if (room) return `room:${room.roomId}:${room.mode}`;
	const object = interaction.objectDrag;
	if (object) return `object:${object.objectId}:${object.mode}`;
	const selection = interaction.selection;
	if (selection.kind === 'physicalWall') return `selected:wall:${selection.wallId}`;
	if (selection.kind === 'wallOpening') return `selected:opening:${selection.openingId}`;
	return 'idle';
}

/** Approximate extent of a dimension string. Placement only, never a readout. */
export function planDimensionTextExtentPx(text: string): { width: number; height: number } {
	return {
		width: text.length * PLAN_DIMENSION_TEXT.fontSizePx * PLAN_DIMENSION_TEXT.advanceRatio,
		height: PLAN_DIMENSION_TEXT.lineHeightPx
	};
}

/** The drawn string: `Width 1.00 m`, `Arc 7.24 m`, or a bare `4.00 m`. */
export function planDimensionText(dimension: PlanDimension): string {
	const label = dimension.arc ? PLAN_DIMENSION_ARC_TAG : dimension.label;
	return label ? `${label} ${dimension.value}` : dimension.value;
}

/** §7's paired delta measure, one line: `ΔX 0.40 m · ΔZ 0.86 m`. */
export function planDeltaText(delta: LayoutVec2): string {
	return `ΔX ${formatMeters(delta[0])} m · ΔZ ${formatMeters(delta[1])} m`;
}

/**
 * How much room a screen box has on each side of the canvas. Side policies whose
 * sides *are* screen directions — the transient pointer-anchored snap word (S5),
 * and a dimension with no band of its own choosing a vertical side — read the
 * canvas through this one measurement, so they cannot disagree about it. A
 * dimension lane's side is its span's normal instead, which is not an up/left vs
 * down/right half-plane, so `planDimensionPreferredSide` measures that direction
 * directly rather than pretending a rotated side is an axis-aligned one.
 */
export function planSidesWithRoom(
	box: { minX: number; minY: number; maxX: number; maxY: number },
	view: Pick<PlanViewportState, 'width' | 'height'>
): { abovePx: number; belowPx: number; leftPx: number; rightPx: number } {
	return {
		abovePx: box.minY,
		belowPx: view.height - box.maxY,
		leftPx: box.minX,
		rightPx: view.width - box.maxX
	};
}

/**
 * Which side of a measured span the lane lands on. Preference is the normal
 * pointing away from the owner the dimension describes (so a Room's width sits
 * outside the face it measures); when the preferred side has less room than the
 * other, the other wins. That is §7's one rule, applied once per gesture.
 */
export function planDimensionPreferredSide(
	span: readonly [LayoutVec2, LayoutVec2],
	view: PlanViewportState,
	outward?: LayoutVec2
): PlanDimensionSide {
	const screenA = worldToPlanScreen(view, span[0]);
	const screenB = worldToPlanScreen(view, span[1]);
	const dx = screenB[0] - screenA[0];
	const dy = screenB[1] - screenA[1];
	const length = Math.hypot(dx, dy);
	if (length <= 1e-6) return 'negative';
	// `negative` is the side of `perp(d) = (-dy, dx)`; `positive` is its mirror.
	const normal: LayoutVec2 = [-dy / length, dx / length];
	const mid: LayoutVec2 = [(screenA[0] + screenB[0]) / 2, (screenA[1] + screenB[1]) / 2];
	// The room a side has is the canvas ahead of the lane *along that side's own
	// direction*. Reading it as "up+left versus down+right" would disagree with
	// what the side means for any span whose normal is not axis-aligned to the
	// canvas — a normal is a rotation of the span, so for a downward or leftward
	// span the roomier half-plane and the roomier lane are different answers, and
	// the lane would take the side with less space.
	const lane = PLAN_DIMENSION_LANES_PX.first;
	const roomTo = (direction: LayoutVec2): number => planRoomAlong(mid, direction, view) - lane;
	const negativeRoom = roomTo([-normal[0], -normal[1]]);
	const positiveRoom = roomTo(normal);
	if (outward) {
		const outwardScreen = worldToPlanScreen(view, outward);
		const projected =
			(outwardScreen[0] - mid[0]) * normal[0] + (outwardScreen[1] - mid[1]) * normal[1];
		// Away from the owner: the sign opposite the owner's own direction.
		const preferred: PlanDimensionSide = projected > 0 ? 'negative' : 'positive';
		const preferredRoom = preferred === 'negative' ? negativeRoom : positiveRoom;
		const otherRoom = preferred === 'negative' ? positiveRoom : negativeRoom;
		if (preferredRoom >= otherRoom) return preferred;
		return preferred === 'negative' ? 'positive' : 'negative';
	}
	return negativeRoom >= positiveRoom ? 'negative' : 'positive';
}

/**
 * Derive the live dimension set: at most one primary measure (lane 1) plus at
 * most one secondary (lane 2), following §7's context table. An active gesture
 * always outranks a selected-idle measure, and a measure whose canonical value
 * is unknown is omitted rather than estimated.
 *
 * Contexts §7 lists that this slice does not derive, and why:
 * - **Poly Room's current segment.** The polygon tool keeps committed points but
 *   no live cursor (`pointermove` resolves the next point only at click), so
 *   there is no segment being drawn to measure. Owner: **S8**, whose per-tool
 *   preview composers add the polygon rubber band this measure depends on.
 * - **Numeric-editing coordinates** (§7's "X/Z when numeric editing") and the
 *   focus-only coordinates: S7 owns the numeric editor; S6 draws deltas, and the
 *   focused-handle coordinates it *can* already resolve.
 * - **Rotation yaw.** Already reported by the existing yaw feedback, which is
 *   §7-compliant (yaw only, no bounding box); re-cutting it would draw a second
 *   one rather than a better one.
 */
export function derivePlanDimensions(
	interaction: LayoutInteractionState,
	facts: PlanDimensionFacts
): PlanDimension[] {
	if (interaction.architectureEdit) {
		return architectureEditDimensions(interaction.architectureEdit, facts);
	}
	if (interaction.wallOpeningDrag) {
		const drag = interaction.wallOpeningDrag;
		const opening = facts.opening(drag.wallId, drag.openingId);
		if (opening) {
			return openingDimensions(
				opening,
				drag.candidateOffset,
				drag.candidateWidth,
				drag.mode !== 'body'
			);
		}
	}
	if (interaction.rectangleStart && interaction.rectangleCurrent) {
		return rectangleDimensions(interaction.rectangleStart, interaction.rectangleCurrent);
	}
	if (interaction.wallChainStart && interaction.wallChainCursor) {
		return legDimensions(interaction.wallChainStart, interaction.wallChainCursor);
	}
	if (interaction.roomUnitDrag && interaction.roomUnitDrag.mode === 'translate') {
		const drag = interaction.roomUnitDrag;
		return deltaDimensions(drag.translation, [
			drag.pivot[0] + drag.translation[0],
			drag.pivot[1] + drag.translation[1]
		]);
	}
	if (interaction.objectDrag && interaction.objectDrag.mode === 'translate') {
		const drag = interaction.objectDrag;
		const delta: LayoutVec2 = [
			drag.candidatePosition[0] - drag.originalPosition[0],
			drag.candidatePosition[2] - drag.originalPosition[2]
		];
		return deltaDimensions(delta, [drag.candidatePosition[0], drag.candidatePosition[2]]);
	}
	return selectedDimensions(interaction, facts);
}

/** §7's "Selected, idle" column: one primary measure, never a chain. */
function selectedDimensions(
	interaction: LayoutInteractionState,
	facts: PlanDimensionFacts
): PlanDimension[] {
	const selection = interaction.selection;
	if (selection.kind === 'physicalWall') {
		const length = facts.wallLength(selection.wallId);
		if (length === null) return [];
		const span = facts.wallSpan(selection.wallId);
		const anchor = span ? midpoint(span) : facts.wallAnchor(selection.wallId);
		// No locus means no honest place to put the number: omitted, not parked at
		// the world origin.
		if (!anchor) return [];
		return [
			{
				key: `selected-wall:${selection.wallId}`,
				label: null,
				measure: 'Length',
				value: `${formatMeters(length)} m`,
				span,
				anchor,
				lane: 1,
				arc: !facts.wallIsStraight(selection.wallId)
			}
		];
	}
	if (selection.kind === 'wallOpening') {
		const opening = facts.opening(selection.wallId, selection.openingId);
		if (!opening) return [];
		// §7 grants the offset to focus, not to rest: the width is the opening's
		// identity, the offset is what a focused control is being asked about.
		const focused = interaction.planFocus?.kind === 'opening-edge';
		return [
			{
				key: `selected-opening:${selection.openingId}`,
				label: 'Width',
				measure: 'Width',
				value: `${formatMeters(opening.width)} m`,
				span: opening.span,
				anchor: opening.anchor,
				lane: 1
			},
			...(focused
				? [
						{
							key: `selected-opening-offset:${selection.openingId}`,
							label: 'Offset',
							measure: 'Offset',
							value: `${formatMeters(opening.offset)} m`,
							span: null,
							anchor: opening.anchor,
							lane: 2 as const
						}
					]
				: [])
		];
	}
	// A selected Room keeps the S3 identity stack (name/reference/area). §7's
	// "no permanent dimension chain" is why this slice *removes* the old
	// per-edge labels rather than restyling them.
	return [];
}

function architectureEditDimensions(
	edit: LayoutArchitectureEditGesture,
	facts: PlanDimensionFacts
): PlanDimension[] {
	if (edit.kind === 'junction-move') {
		return deltaDimensions(
			[edit.candidatePoint[0] - edit.baselinePoint[0], edit.candidatePoint[1] - edit.baselinePoint[1]],
			edit.candidatePoint
		);
	}
	if (edit.kind === 'wall-move') {
		const anchor: LayoutVec2 = [
			edit.baselineGrabPoint[0] + edit.candidateDelta[0],
			edit.baselineGrabPoint[1] + edit.candidateDelta[1]
		];
		const moved = deltaDimensions(edit.candidateDelta, anchor);
		// §7: "ΔX / ΔZ; baseline" — the delta plus the extent that is moving.
		const length = facts.wallLength(edit.wallId);
		if (length === null) return moved;
		return [
			...moved,
			{
				key: `wall-move-length:${edit.wallId}`,
				label: null,
				measure: 'Length',
				value: `${formatMeters(length)} m`,
				span: null,
				anchor,
				lane: 2,
				arc: !facts.wallIsStraight(edit.wallId)
			}
		];
	}
	// Both bend gestures *change the curve*, so the measurement that matters is
	// the canonical arc length — a chord through the band would report a shorter
	// wall than the one being built (§7's explicit `arc` label).
	const anchor = edit.candidatePoint;
	const length = facts.wallLength(edit.wallId);
	if (length === null) return [];
	return [
		{
			key: `bend-length:${edit.wallId}`,
			label: null,
			measure: 'Arc length',
			value: `${formatMeters(length)} m`,
			span: null,
			anchor,
			lane: 1,
			arc: !facts.wallIsStraight(edit.wallId)
		}
	];
}

function openingDimensions(
	opening: PlanDimensionOpeningFacts,
	offset: number,
	width: number,
	resizing: boolean
): PlanDimension[] {
	// §7's two Opening rows: an *insert or slide* reports the canonical-start
	// offset plus the nearest clearance, a *resize* reports the clearance it is
	// changing (its offset is not what the gesture moves). Neither row may invent
	// the clearance, so an unknown one is simply absent.
	const parts = resizing ? [] : [`Offset ${formatMeters(offset)} m`];
	if (opening.clearance !== null) parts.push(`clearance ${formatMeters(opening.clearance)} m`);
	return [
		{
			key: 'opening-width',
			label: 'Width',
			measure: 'Width',
			value: `${formatMeters(width)} m`,
			span: opening.span,
			anchor: opening.anchor,
			lane: 1
		},
		...(parts.length > 0
			? [
					{
						key: 'opening-placement',
						label: null,
						measure: resizing ? 'Clearance' : 'Offset',
						value: parts.join(' · '),
						span: null,
						anchor: opening.anchor,
						lane: 2 as const
					}
				]
			: [])
	];
}

function rectangleDimensions(start: LayoutVec2, current: LayoutVec2): PlanDimension[] {
	const centroid: LayoutVec2 = [(start[0] + current[0]) / 2, (start[1] + current[1]) / 2];
	const widthEdge: [LayoutVec2, LayoutVec2] = [
		[start[0], start[1]],
		[current[0], start[1]]
	];
	const depthEdge: [LayoutVec2, LayoutVec2] = [
		[start[0], start[1]],
		[start[0], current[1]]
	];
	// §7: "Width + depth; candidate enclosure" — both faces, both outside the
	// candidate room, so neither dimension reads as the room's own outline.
	return [
		{
			key: 'rect:width',
			label: null,
			measure: 'Width',
			value: `${formatMeters(Math.abs(current[0] - start[0]))} m`,
			span: widthEdge,
			anchor: midpoint(widthEdge),
			lane: 1,
			outward: centroid
		},
		{
			key: 'rect:depth',
			label: null,
			measure: 'Depth',
			value: `${formatMeters(Math.abs(current[1] - start[1]))} m`,
			span: depthEdge,
			anchor: midpoint(depthEdge),
			lane: 2,
			outward: centroid
		}
	];
}

function legDimensions(start: LayoutVec2, cursor: LayoutVec2): PlanDimension[] {
	const length = Math.hypot(cursor[0] - start[0], cursor[1] - start[1]);
	// A zero-length leg is not a measurement of nothing — it is a proposal the
	// planner will refuse, and the draft already wears §6's invalid language. A
	// "0.00 m / 0°" beside it would be two numbers answering no question, so the
	// same rule the refusal uses decides it here.
	if (length <= PLAN_DIMENSION_DEGENERATE_EPSILON) return [];
	const span: [LayoutVec2, LayoutVec2] = [start, cursor];
	const angle = (Math.atan2(cursor[1] - start[1], cursor[0] - start[0]) * 180) / Math.PI;
	return [
		{
			key: 'leg:length',
			label: null,
			measure: 'Length',
			value: `${formatMeters(length)} m`,
			span,
			anchor: midpoint(span),
			lane: 1
		},
		{
			key: 'leg:angle',
			label: null,
			measure: 'Angle',
			value: `${formatDegrees(angle)}°`,
			span: null,
			anchor: midpoint(span),
			lane: 2
		}
	];
}

function deltaDimensions(delta: LayoutVec2, anchor: LayoutVec2): PlanDimension[] {
	if (Math.hypot(delta[0], delta[1]) <= 1e-9) return [];
	return [
		{ key: 'delta', label: null, measure: 'ΔX / ΔZ', value: planDeltaText(delta), span: null, anchor, lane: 1 }
	];
}

function midpoint(span: readonly [LayoutVec2, LayoutVec2]): LayoutVec2 {
	return [(span[0][0] + span[1][0]) / 2, (span[0][1] + span[1][1]) / 2];
}

/** The lane a measure offsets along, in screen px, and the side that is. */
export type PlanDimensionLane = { direction: LayoutVec2; side: PlanDimensionSide };

/**
 * §7's lane for the set's band: the perpendicular a lane offsets along, taken
 * from the one measure in the set that has an extent and the side the freeze
 * chose for it. A span-less measure borrows it, which is what makes the two lanes
 * *lanes* — 18 px from the band and a second at 34 px on the same side
 * — instead of two numbers straddling the geometry they describe. `null` when no
 * measure in the set has an extent: then there is no band to offset from.
 */
export function planDimensionBandDirection(
	dimensions: readonly PlanDimension[],
	view: PlanViewportState,
	options: {
		side?: PlanDimensionSide;
		memory?: PlanDimensionMemory;
		gestureKey?: string;
	} = {}
): PlanDimensionLane | null {
	const owner = dimensions.find((dimension) => dimension.span !== null);
	if (!owner?.span) return null;
	const screenA = worldToPlanScreen(view, owner.span[0]);
	const screenB = worldToPlanScreen(view, owner.span[1]);
	const dx = screenB[0] - screenA[0];
	const dy = screenB[1] - screenA[1];
	const length = Math.hypot(dx, dy);
	if (length <= 1e-6) return null;
	const side = resolvePlanDimensionSide(owner, view, options);
	const sign = side === 'negative' ? -1 : 1;
	// The owner's own lane normal, `perp(d) · sign` — computed here from the same
	// span the owner's placement uses, so the pair cannot disagree about which way
	// "the lane's side" points.
	return { direction: [(-dy / length) * sign, (dx / length) * sign], side };
}

/**
 * The side a measure with an extent takes: the caller's override, else §7's
 * frozen decision for this gesture-measure, else a fresh room-based choice.
 */
function resolvePlanDimensionSide(
	dimension: PlanDimension,
	view: PlanViewportState,
	options: {
		side?: PlanDimensionSide;
		memory?: PlanDimensionMemory;
		gestureKey?: string;
	}
): PlanDimensionSide {
	const choose = (): PlanDimensionSide =>
		planDimensionPreferredSide(dimension.span!, view, dimension.outward);
	return (
		options.side ??
		options.memory?.sideFor(options.gestureKey ?? 'idle', dimension.key, choose) ??
		choose()
	);
}

/**
 * Where a measure with no extent and no band in its set goes: onto the roomier
 * side of its locus, measured by the same `planSidesWithRoom` every other side
 * policy reads, and frozen the same way. `negative` is up, `positive` down.
 */
function planDimensionLocusDirection(
	dimension: PlanDimension,
	screen: LayoutVec2,
	view: PlanViewportState,
	options: {
		side?: PlanDimensionSide;
		memory?: PlanDimensionMemory;
		gestureKey?: string;
	}
): PlanDimensionLane {
	const choose = (): PlanDimensionSide => {
		const room = planSidesWithRoom(
			{ minX: screen[0], maxX: screen[0], minY: screen[1], maxY: screen[1] },
			view
		);
		return room.belowPx >= room.abovePx ? 'positive' : 'negative';
	};
	const side =
		options.side ??
		options.memory?.sideFor(options.gestureKey ?? 'idle', dimension.key, choose) ??
		choose();
	return { direction: side === 'negative' ? [0, -1] : [0, 1], side };
}

/**
 * Place the derived set: lane offsets, the frozen side, the 0.75 px witnesses,
 * the 4 px ticks and the text, with §7's short-span push-out and readout
 * fallback. Pure — the only state is the frozen side the caller hands in.
 *
 * A measure *with* an extent offsets from its own span; a measure *without* one
 * (a delta, an arc read off a curve, a focused offset) has no band of its own, so
 * it rides `planDimensionBandDirection` — the set's band — and only chooses a
 * vertical side of its own when the set has no extent at all. Either way the
 * offset is a *lane*, and a lane that would land off the paper flips to its
 * mirror before it gives up and reports to the readout.
 */
export function placePlanDimensions(
	dimensions: readonly PlanDimension[],
	view: PlanViewportState,
	options: {
		/** Overrides the chooser entirely (tests, caller-owned policy). */
		side?: PlanDimensionSide;
		/** §7's freeze: the chosen side is remembered per gesture-measure. */
		memory?: PlanDimensionMemory;
		gestureKey?: string;
		/** Which end a pushed-out text moves past. Defaults to the roomier end. */
		pushToward?: PlanDimensionPushToward;
	} = {}
): PlanDimensionOutcome {
	const placed: PlanDimensionPlacement[] = [];
	const readout: PlanDimensionReadoutEntry[] = [];
	// §7's one lane geometry for the gesture: resolved once per call so a
	// span-less sibling reads exactly the band its set is being measured from.
	const band = planDimensionBandDirection(dimensions, view, options);
	for (const dimension of dimensions) {
		const text = planDimensionText(dimension);
		const extent = planDimensionTextExtentPx(text);
		const lane = PLAN_DIMENSION_LANES_PX[dimension.lane === 1 ? 'first' : 'second'];
		if (!dimension.span) {
			// No extent to witness: the value sits in its lane beside the locus,
			// offset along the set's band when there is one.
			const anchor = worldToPlanScreen(view, dimension.anchor);
			const locusOnCanvas =
				anchor[0] >= -PLAN_DIMENSION_INSET_PX &&
				anchor[0] <= view.width + PLAN_DIMENSION_INSET_PX &&
				anchor[1] >= -PLAN_DIMENSION_INSET_PX &&
				anchor[1] <= view.height + PLAN_DIMENSION_INSET_PX;
			// Same rule as an off-canvas span: silently absent, never "reported".
			if (!locusOnCanvas) continue;
			const resolvedLane =
				band ?? planDimensionLocusDirection(dimension, anchor, view, options);
			const direction = resolvedLane.direction;
			const laneAt = (along: LayoutVec2): LayoutVec2 => [
				anchor[0] + along[0] * lane,
				anchor[1] + along[1] * lane
			];
			// §7: the text is centred on the line and baseline-sits on it, so its
			// box is half a width either side of the lane point and one line above.
			const inPaper = (point: LayoutVec2): boolean =>
				point[0] - extent.width / 2 >= PLAN_DIMENSION_INSET_PX &&
				point[0] + extent.width / 2 <= view.width - PLAN_DIMENSION_INSET_PX &&
				point[1] - extent.height >= PLAN_DIMENSION_INSET_PX &&
				point[1] <= view.height - PLAN_DIMENSION_INSET_PX;
			// A lane that would leave the paper mirrors before it gives up: the
			// mirror of a lane is still that measure's lane, whereas the readout is
			// the last resort.
			const mirrored = !inPaper(laneAt(direction));
			const position = laneAt(mirrored ? [-direction[0], -direction[1]] : direction);
			if (!inPaper(position)) {
				push(readout, dimension, text);
				continue;
			}
			placed.push({
				key: dimension.key,
				lane: dimension.lane,
				// The side the measure actually took: §7's freeze holds the *lane*, and
				// a lane whose own side has run out of paper — a panned view, a second
				// lane further out — mirrors rather than reporting, so the record has to
				// say which side the number is really on.
				side: mirrored
					? resolvedLane.side === 'negative'
						? 'positive'
						: 'negative'
					: resolvedLane.side,
				witnesses: [],
				line: null,
				ticks: [],
				text: position,
				pushedOut: false
			});
			continue;
		}
		const screenA = worldToPlanScreen(view, dimension.span[0]);
		const screenB = worldToPlanScreen(view, dimension.span[1]);
		const dx = screenB[0] - screenA[0];
		const dy = screenB[1] - screenA[1];
		const spanPx = Math.hypot(dx, dy);
		if (spanPx <= 1e-6) {
			push(readout, dimension, text);
			continue;
		}
		const along: LayoutVec2 = [dx / spanPx, dy / spanPx];
		const normal: LayoutVec2 = [-along[1], along[0]];
		const resolved = resolvePlanDimensionSide(dimension, view, options);
		const sign = resolved === 'negative' ? -1 : 1;
		const laneNormal: LayoutVec2 = [normal[0] * sign, normal[1] * sign];
		const lineA: LayoutVec2 = [screenA[0] + laneNormal[0] * lane, screenA[1] + laneNormal[1] * lane];
		const lineB: LayoutVec2 = [screenB[0] + laneNormal[0] * lane, screenB[1] + laneNormal[1] * lane];
		// §7's 4 px slanted tick: one 45° stroke across each end of the line.
		const tickDir: LayoutVec2 = [
			(along[0] + laneNormal[0]) / Math.SQRT2,
			(along[1] + laneNormal[1]) / Math.SQRT2
		];
		const half = PLAN_DIMENSION_TICK_LENGTH_PX / 2;
		const ticks: (readonly [LayoutVec2, LayoutVec2])[] = [lineA, lineB].map((end) => [
			[end[0] - tickDir[0] * half, end[1] - tickDir[1] * half],
			[end[0] + tickDir[0] * half, end[1] + tickDir[1] * half]
		]);
		const centre: LayoutVec2 = [(lineA[0] + lineB[0]) / 2, (lineA[1] + lineB[1]) / 2];
		// §7: a short span pushes the text outward rather than shrinking it, and a
		// span shorter than the text can never hold it — both push.
		const fits = spanPx >= PLAN_DIMENSION_SHORT_SPAN_PX && spanPx >= extent.width + PLAN_DIMENSION_TEXT_PAD_PX * 2;
		let textAt = centre;
		let pushedOut = false;
		if (!fits) {
			const toward =
				options.pushToward ??
				planDimensionPushToward(screenA, screenB, along, view);
			const pushSign = toward === 'end' ? 1 : -1;
			const reach = extent.width / 2 + PLAN_DIMENSION_TEXT_PAD_PX;
			textAt = [centre[0] + along[0] * reach * pushSign, centre[1] + along[1] * reach * pushSign];
			pushedOut = true;
		}
		// Whether the measured span is on the canvas at all. A dimension whose
		// geometry has been panned away is not an unreadable dimension — the whole
		// context is off-screen — so it is skipped silently rather than reported,
		// because a readout for a wall the user cannot see would be noise claiming
		// to be a fallback.
		const spanOnCanvas =
			Math.min(lineA[0], lineB[0]) <= view.width + PLAN_DIMENSION_INSET_PX &&
			Math.max(lineA[0], lineB[0]) >= -PLAN_DIMENSION_INSET_PX &&
			Math.min(lineA[1], lineB[1]) <= view.height + PLAN_DIMENSION_INSET_PX &&
			Math.max(lineA[1], lineB[1]) >= -PLAN_DIMENSION_INSET_PX;
		if (!spanOnCanvas) continue;
		const textInside =
			textAt[0] - extent.width / 2 >= PLAN_DIMENSION_INSET_PX &&
			textAt[0] + extent.width / 2 <= view.width - PLAN_DIMENSION_INSET_PX &&
			textAt[1] >= PLAN_DIMENSION_INSET_PX &&
			textAt[1] <= view.height - PLAN_DIMENSION_INSET_PX;
		if (pushedOut && !textInside) {
			// §7: pushed out, then to readout. The measurement is never dropped and
			// never shrunk — it moves somewhere it can be read.
			push(readout, dimension, text);
			continue;
		}
		placed.push({
			key: dimension.key,
			lane: dimension.lane,
			side: resolved,
			witnesses: [
				[screenA, lineA],
				[screenB, lineB]
			],
			line: [lineA, lineB],
			ticks,
			text: textAt,
			pushedOut
		});
	}
	return { placed, readout };
}

/** Which end of a span a pushed-out text moves past. */
export type PlanDimensionPushToward = 'start' | 'end';

/**
 * How much canvas a point has in one direction before the boundary. The one
 * measurement every push decision reads.
 */
function planRoomAlong(
	point: LayoutVec2,
	direction: LayoutVec2,
	view: Pick<PlanViewportState, 'width' | 'height'>
): number {
	let room = Number.POSITIVE_INFINITY;
	if (direction[0] > 1e-9) room = Math.min(room, (view.width - point[0]) / direction[0]);
	else if (direction[0] < -1e-9) room = Math.min(room, point[0] / -direction[0]);
	if (direction[1] > 1e-9) room = Math.min(room, (view.height - point[1]) / direction[1]);
	else if (direction[1] < -1e-9) room = Math.min(room, point[1] / -direction[1]);
	return Number.isFinite(room) ? Math.max(room, 0) : 0;
}

/**
 * §7 says a short span pushes its text "outward" without naming an end, so the
 * end is chosen by room: the one whose outward direction has more canvas ahead
 * of it. Deterministic, and it keeps the pushed number on the paper in every
 * ordinary case — the readout then holds only what genuinely cannot be placed
 * either way, rather than whatever happened to point at the nearest edge.
 */
export function planDimensionPushToward(
	screenA: LayoutVec2,
	screenB: LayoutVec2,
	along: LayoutVec2,
	view: Pick<PlanViewportState, 'width' | 'height'>
): PlanDimensionPushToward {
	const forward = planRoomAlong(screenB, along, view);
	const backward = planRoomAlong(screenA, [-along[0], -along[1]], view);
	return forward >= backward ? 'end' : 'start';
}

function push(readout: PlanDimensionReadoutEntry[], dimension: PlanDimension, text: string): void {
	if (readout.length >= PLAN_DIMENSION_MAX_READOUT) return;
	readout.push({ key: dimension.key, measure: dimension.measure, value: text });
}
