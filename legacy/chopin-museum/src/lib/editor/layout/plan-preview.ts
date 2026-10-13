/**
 * `plan-preview.ts` — P23.13 S8 / §7: what a gesture's preview may *claim*.
 *
 * Drafting has one preview pipeline and several gestures, and §7 asks each of
 * them a different question. Most of those answers are already structural: each
 * gesture block paints its own composition, and the band/cap/join ink it uses is
 * S1's canonical grammar. Restating that as a second table here would be a
 * parallel vocabulary nobody reads — the failure mode this slice has already
 * pruned twice — so this module declares only the row that actually *decides*
 * something:
 *
 * ```text
 * canonical candidate yields a face → faint Room fill
 * closes but no face               → say `Close at junction`
 * not closing                      → nothing
 * ```
 *
 * The face is never inferred from proximity, from a closed-looking polygon, or
 * from "a Room probably appears here": the caller must bring canonical evidence
 * (`wallChainClosureEvidence`, which plans the closing leg and reads the face out
 * of that plan). Without it the strongest honest cue is `Close at junction`,
 * which promises no enclosure at all.
 *
 * Nothing here paints, projects or measures, and nothing here is a second
 * geometry truth: the polygons that reach the paint layer come from the
 * canonical plan, never from this module.
 */

/** The gestures whose run can ask for a closure cue (spec §7's rows). */
export type PlanPreviewTool =
	/** Wall chain (`wall-chain`): a boundary run, which can birth a Room. */
	| 'wall-draw'
	/** Partition chain: a run that never births a Room, whatever it closes onto. */
	| 'partition-draw';

/** §7's closure outcome for one frame. */
export type PlanClosureCue = 'none' | 'close-at-junction' | 'room-face';

/**
 * How a tool can earn a closure cue at all.
 *
 * `canonical-face` — the run can birth a Room, so the cue must be *proved* by
 * canonical evidence before it may show a face.
 * `junction-only` — the run can only ever end on a junction (a partition), so no
 * face is ever promised and the junction copy is the whole cue.
 */
export type PlanClosureRule = 'canonical-face' | 'junction-only';

/** The table. Exhaustive by type: a new run tool must decide its own rule. */
const PLAN_CLOSURE_RULES: Readonly<Record<PlanPreviewTool, PlanClosureRule>> = {
	'wall-draw': 'canonical-face',
	'partition-draw': 'junction-only'
};

export function planClosureRule(tool: PlanPreviewTool): PlanClosureRule {
	return PLAN_CLOSURE_RULES[tool];
}

/**
 * §7's closure cue for one frame.
 *
 * `yieldsFace` is canonical evidence supplied by the caller, and it is only ever
 * consulted for a rule that can birth a Room — a partition closes onto a junction
 * and says so, even if some face happened to appear. The cue also requires the
 * candidate to be actually closing: a live leg nowhere near its run start gets
 * no cue at all rather than a distant promise.
 */
export function resolvePlanClosureCue(input: {
	tool: PlanPreviewTool;
	/** The candidate is resolving onto its run's start junction. */
	closing: boolean;
	/** Canonical evidence: the closing leg's own plan creates a Room. */
	yieldsFace: boolean;
}): PlanClosureCue {
	if (!input.closing) return 'none';
	if (planClosureRule(input.tool) === 'junction-only') return 'close-at-junction';
	return input.yieldsFace ? 'room-face' : 'close-at-junction';
}
