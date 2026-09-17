/**
 * `plan-keyboard-traversal.ts` — P23.13 S10: control-group keyboard traversal.
 *
 * Spec §9: a keyboard path to every displayed actionable handle. The canvas is
 * the single tab stop (Tab enters and leaves it; nothing traps); Enter moves
 * into the selected owner's control group, arrows walk it in canonical
 * endpoint/arc order with wrap, Enter on a focused control reaches S7's
 * numeric door, and Escape unwinds focus without touching selection or
 * history.
 *
 * Pure module (same precedent as `plan-numeric-entry.ts`): the group is built
 * from canonical layout facts the caller already holds, so the order cannot
 * drift from the document — a control id here is the same id the acquisition
 * engine focuses and the paint layer rings, and a group the document cannot
 * supply is `null` rather than a guess. Moving focus is never an edit.
 */
import type { PlanControlKind } from '$lib/layout/plan-control-grammar';

/** One keyboard-reachable control: the acquisition engine's own identity. */
export type PlanTraversalControl = {
	kind: PlanControlKind;
	id: string;
	ownerId: string;
};

/** Minimal canonical facts a traversal group is built from. */
export type PlanTraversalSelection =
	| { kind: 'physicalWall'; wallId: string }
	| { kind: 'wallOpening'; openingId: string }
	| { kind: 'junction'; junctionId: string }
	| { kind: 'other' };

export type PlanTraversalLayout = {
	/** Wall endpoints plus curve-knot ids in arc order. */
	walls: ReadonlyMap<string, { startJunctionId: string; endJunctionId: string; knotIds: readonly string[] }>;
	junctions: ReadonlySet<string>;
};

/** Screen-reader words for the control kinds a group can hold. */
export const PLAN_TRAVERSAL_KIND_WORDS: Readonly<Record<PlanControlKind, string>> = {
	junction: 'Junction',
	'curve-control': 'Curve point',
	'opening-edge': 'Opening edge',
	'opening-slide': 'Opening slide',
	'object-rotation': 'Object rotation handle',
	'room-rotation': 'Room rotation handle'
};

/**
 * The selected owner's control group in canonical endpoint/arc order, or
 * `null` when the selection owns no keyboard group. Order is document order
 * along the entity: a Wall reads start junction → curve knots in arc order →
 * end junction; an Opening reads start edge → slide grip → end edge; a
 * Junction is its own single control. Anything else (rooms, objects, anchors,
 * no selection, unknown ids) is `null` — absence is the enforcement, so the
 * keyboard can never focus a control the document cannot supply.
 */
export function planTraversalGroup(
	selection: PlanTraversalSelection,
	layout: PlanTraversalLayout
): readonly PlanTraversalControl[] | null {
	switch (selection.kind) {
		case 'physicalWall': {
			const wall = layout.walls.get(selection.wallId);
			if (!wall) return null;
			if (!layout.junctions.has(wall.startJunctionId)) return null;
			if (!layout.junctions.has(wall.endJunctionId)) return null;
			const group: PlanTraversalControl[] = [
				{ kind: 'junction', id: wall.startJunctionId, ownerId: wall.startJunctionId }
			];
			for (const knotId of wall.knotIds) {
				group.push({ kind: 'curve-control', id: knotId, ownerId: selection.wallId });
			}
			group.push({ kind: 'junction', id: wall.endJunctionId, ownerId: wall.endJunctionId });
			return group;
		}
		case 'wallOpening': {
			if (!selection.openingId) return null;
			return [
				{ kind: 'opening-edge', id: `${selection.openingId}:start`, ownerId: selection.openingId },
				{ kind: 'opening-slide', id: `${selection.openingId}:slide`, ownerId: selection.openingId },
				{ kind: 'opening-edge', id: `${selection.openingId}:end`, ownerId: selection.openingId }
			];
		}
		case 'junction': {
			if (!layout.junctions.has(selection.junctionId)) return null;
			return [{ kind: 'junction', id: selection.junctionId, ownerId: selection.junctionId }];
		}
		case 'other':
			return null;
	}
}

/**
 * Step within a group in canonical order with wrap. `direction` is +1
 * (ArrowRight/ArrowDown) or −1 (ArrowLeft/ArrowUp).
 *
 * A step is only ever a step *inside* a group the user has already entered, so
 * a `currentId` that is not in `group` (including `null`) answers `null` and the
 * caller leaves the key alone. That is A5's state machine verbatim — "Enter on a
 * selected entity enters its control group; arrow keys traverse controls" — and
 * the earlier cut of this module, which let an arrow enter the group at the
 * pressed end, was wrong in a way that reached the user: a selected Wall
 * swallowed ArrowRight/ArrowLeft/ArrowUp (and their scrolling) before anything
 * had been entered, which is exactly the arrow-key theft a roving convention is
 * meant to avoid.
 */
export function planTraversalStep(
	group: readonly PlanTraversalControl[],
	currentId: string | null,
	direction: 1 | -1
): PlanTraversalControl | null {
	if (group.length === 0 || currentId === null) return null;
	const index = group.findIndex((control) => control.id === currentId);
	if (index === -1) return null;
	return group[(index + direction + group.length) % group.length] ?? null;
}

/**
 * Announcement text for a keyboard focus move: control role, position in the
 * group, the owner's identity label the caller resolved, and — when the focused
 * control carries one — the current value and units §9's readout owes
 * ("name/reference, control role, current value and units").
 *
 * `valueText` is composed by the caller from canonical facts (the same fields
 * the numeric door seeds from), so this stays pure text: no measurement model,
 * no second rounding. `null` is a real answer — a control with no canonical
 * value to report announces no value rather than inventing one. Pointer moves
 * never announce: the ring is feedback the eye already has, and a live region
 * per pointermove is exactly what §9 forbids.
 */
export function planTraversalAnnouncement(
	control: PlanTraversalControl,
	index: number,
	groupSize: number,
	ownerLabel: string,
	valueText: string | null = null
): string {
	const word = PLAN_TRAVERSAL_KIND_WORDS[control.kind];
	const value = valueText ? ` — ${valueText}` : '';
	return `${word} ${index + 1} of ${groupSize} — ${ownerLabel}${value}`;
}
