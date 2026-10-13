/**
 * `plan-keyboard-readout.ts` — §9's control readout: the focused control's
 * current value and units, resolved from canonical document facts.
 *
 * **Why this is its own module (T2b).** The mapping control → *which* canonical
 * fact it reads → readout text used to live inside `LayoutPlanViewport.svelte`,
 * a 5.8k-line component, where no test could reach it: the suite could only pin
 * the source text that mentioned it, so K3 — the one gap the harvest rated
 * highest — was "the readout has zero direct callers in tests". The decision is
 * pure: a control kind, the fact that kind reads, and the units that fact is
 * spoken in. Only the *lookups* need the live document, and those stay in the
 * component behind `PlanKeyboardControlFacts`. Splitting them makes the rule
 * testable and leaves the component with the one job it can do and a test
 * cannot: reaching the current document.
 *
 * **The rule (§9 + §7, spec table §6).** One control, one measure:
 *
 * - a Junction reads its document coordinate (`X … m, Z … m`);
 * - a curve control reads the authored knot's coordinate;
 * - an Opening width edge reads the Opening's **width**, and the paired slide
 *   grip reads its **offset** — never both, because they are two fields and the
 *   keyboard is speaking about one control;
 * - a control whose fact has no canonical value yet (a legacy draft junction, a
 *   knot no Wall owns) answers `null`, and the announcement omits the value
 *   clause rather than fabricating a zero.
 *
 * The text itself is composed by `planNumericHostReadout`, the same module the
 * numeric door seeds its fields from, so the number the user hears is the number
 * the door would show.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { PlanTraversalControl } from './plan-keyboard-traversal';
import { planNumericHostReadout } from './plan-numeric-entry';

/**
 * The canonical facts a readout may read, each by the identity it is keyed by.
 * A caller answers `null` for a fact the document does not hold (never a zero
 * stand-in), and a fact it cannot resolve for that identity at all.
 */
export type PlanKeyboardControlFacts = {
	/** Canonical Junction coordinate, or `null` when the document holds no such Junction. */
	junctionPoint(junctionId: string): LayoutVec2 | null;
	/** Authored bend-knot coordinate, or `null` when no Wall owns the knot. */
	curveKnotPoint(knotId: string): LayoutVec2 | null;
	/** The canonical Opening record's own measures, or `null`. */
	opening(openingId: string): { readonly width: number; readonly offset: number } | null;
};

/**
 * The three lookups a wall-first document answers, in the order §9 asks for
 * them: a Junction by canonical id, a bend knot by authored id (across Walls,
 * because the knot id is the control's identity), and an Opening record by
 * owner id. `null` for a document of another format: a legacy Layout has no
 * canonical Junction, so every readout answers "no value" rather than a guess.
 *
 * Exported so the component and a test resolve the *same* facts through the
 * same code — the component passes its live document, a test its fixture.
 */
export function planKeyboardControlFactsFromLayout(
	layout: LayoutDocumentWallFirst | null
): PlanKeyboardControlFacts {
	return {
		junctionPoint(junctionId) {
			const junction = layout?.junctions.find((candidate) => candidate.id === junctionId);
			return junction ? ([junction.point[0], junction.point[1]] as LayoutVec2) : null;
		},
		curveKnotPoint(knotId) {
			if (!layout) return null;
			for (const wall of layout.walls) {
				if (wall.centerline.kind !== 'cubic-chain') continue;
				const knot = wall.centerline.knots.find((candidate) => candidate.id === knotId);
				if (knot) return [knot.point[0], knot.point[1]] as LayoutVec2;
			}
			return null;
		},
		opening(openingId) {
			const opening = layout?.openings.find((candidate) => candidate.id === openingId);
			return opening ? { width: opening.width, offset: opening.offset } : null;
		}
	};
}

/**
 * The readout for one focused control: its current value and units, or `null`
 * where the document holds no value for it (role and owner are then announced
 * without a number, which is a real answer rather than a missing one).
 */
export function planKeyboardControlReadout(
	control: PlanTraversalControl,
	facts: PlanKeyboardControlFacts
): string | null {
	if (control.kind === 'junction') {
		const point = facts.junctionPoint(control.id);
		return point ? planNumericHostReadout('junction', { x: point[0], z: point[1] }) : null;
	}
	if (control.kind === 'curve-control') {
		const knot = facts.curveKnotPoint(control.id);
		return knot ? planNumericHostReadout('curve-point', { x: knot[0], z: knot[1] }) : null;
	}
	if (control.kind === 'opening-edge' || control.kind === 'opening-slide') {
		const opening = facts.opening(control.ownerId);
		if (!opening) return null;
		// One field each: the width edge is the width's handle and the paired grip
		// the offset's (§7), so an edge never reports the grip's number too.
		return control.kind === 'opening-edge'
			? planNumericHostReadout('opening-resize', { width: opening.width })
			: planNumericHostReadout('opening-slide', { offset: opening.offset });
	}
	return null;
}
