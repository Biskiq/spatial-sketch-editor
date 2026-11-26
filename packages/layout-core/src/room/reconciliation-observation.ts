import type { CorrespondenceAuthorization, CorrespondencePairClass } from './reconciliation-correspondence';

/**
 * One `buildCorrespondenceComponents` pass, as an optional observer sees it
 * (opt-in, never retained, omitting it changes nothing at all).
 *
 * ACCOUNTING, per mode:
 *
 * ```text
 * short-circuit  pairs = identitySettled + authorizationSkips + absentEvidenceSkips
 *                       + boundsSkips + insideCalls + insideSkipsByBounds
 *                identitySettled = identityUnions + identityRefusals
 *                (every pair is accounted exactly once: settled by the identity
 *                 condition, denied by the D-12 labels, skipped for absent evidence,
 *                 pruned by the inflated boxes, skipped only for the containment CALL,
 *                 or VISITED by the containment step);
 *                insideCalls + insideSkipsByBounds = insideDecisions + overlapCalls
 *                (each pair that reached containment either decided the merge — and
 *                 never paid the overlap predicate — or fell through to it, as did
 *                 every pair whose containment CALL was bounds-skipped);
 *                insideDecisions <= insideCalls,
 * exhaustive     insideCalls = overlapCalls = pairs, both predicate STEPS run for
 *                 every pair exactly as the pre-M-1 loop did, and every skip
 *                 counter is zero — this is OR-2's comparison side, not a shipped
 *                 path. `insideDecisions`/`overlapDecisions` record the predicates'
 *                 own ADMISSIONS here (a pair inside-or-overlapping BEYOND the
 *                 authorization test this order runs afterwards), which is what
 *                 makes a D-12 denial checkable: geometry admits, identity denies.
 * ```
 *
 * "CALL" IS A PAIR VISIT TO THE STEP: the step's own guard (`witness !== undefined` /
 * `polygon !== undefined`) may have no evidence to hand the predicate, and today's
 * loop visits such a pair too — the visit is what the frozen `insideEvaluations`
 * counts, so both sides count the same thing.
 *
 * A cross-group pair therefore contributes NO geometry call in short-circuit mode,
 * which is OR-6's deterministic assertion: the group check is unconditional, so
 * the number is zero for EVERY operation, not only for the clear-gap case.
 */
export type CorrespondenceObservation = {
	/** The evaluation order this pass used. */
	mode: 'short-circuit' | 'exhaustive';
	pairs: number;
	sameGroupPairs: number;
	crossGroupPairs: number;
	undefinedPairs: number;
	/**
	 * M-3 — pairs IDENTITY settled without any geometry: a predecessor Room whose own
	 * boundary cycle still exists as an unambiguous candidate face, against a face whose
	 * single owner is unambiguous. `identityUnions` are the claims (the Room keeps its own
	 * face); `identityRefusals` are the contrapositive (the face belongs to another Room),
	 * which is what removes a connected plan's neighbour pairs. An ambiguous face — two
	 * Rooms naming one face, the merge shape — is NEVER settled, so these counters cannot
	 * hide a merge; those pairs keep the geometric proof.
	 */
	identitySettled: number;
	identityUnions: number;
	identityRefusals: number;
	/** (a) pairs denied by `unionAuthorized` before any geometry. */
	authorizationSkips: number;
	/**
	 * (b0) pairs with NEITHER piece of evidence (no witness and no polygon): both
	 * conditions are false by definition, so today's exhaustive loop walks them and
	 * discards them — the skip saves the walk, never a verdict.
	 */
	absentEvidenceSkips: number;
	/** (b) pairs pruned by the inflated boxes: BOTH conditions proven impossible. */
	boundsSkips: number;
	/**
	 * Pairs that passed (b) with `inside` PROVEN false from the witness's own box, so
	 * the strict-containment predicate was not called and they went straight to the
	 * overlap predicate. A call saving, never a verdict change.
	 */
	insideSkipsByBounds: number;
	insideCalls: number;
	insideCallsSameGroup: number;
	insideCallsCrossGroup: number;
	insideCallsUndefined: number;
	/**
	 * Pairs the containment predicate ADMITTED: in short-circuit mode that IS the
	 * union (c), with the overlap predicate skipped; in exhaustive mode it is the
	 * predicate's own result, recorded before the authorization test that today's
	 * order runs next.
	 */
	insideDecisions: number;
	overlapCalls: number;
	overlapCallsSameGroup: number;
	overlapCallsCrossGroup: number;
	overlapCallsUndefined: number;
	/**
	 * Pairs the overlap predicate ADMITTED — the union in short-circuit mode, the
	 * admission alone in exhaustive mode (see `insideDecisions`).
	 */
	overlapDecisions: number;
};


/** One pass's report sink; omitted by production callers. */
export type CorrespondenceObserver = (observation: CorrespondenceObservation) => void;


/**
 * Optional per-pass controls. `exhaustive` runs the PRE-M-1 loop verbatim — both
 * predicates for every pair, geometry before authorization, no pruning — so a
 * differential always has today's evaluation order to compare against.
 */
export type CorrespondencePassOptions = {
	observer?: CorrespondenceObserver;
	exhaustive?: boolean;
};


export function emptyCorrespondenceObservation(
	mode: CorrespondenceObservation['mode']
): CorrespondenceObservation {
	return {
		mode,
		pairs: 0,
		sameGroupPairs: 0,
		crossGroupPairs: 0,
		undefinedPairs: 0,
		identitySettled: 0,
		identityUnions: 0,
		identityRefusals: 0,
		authorizationSkips: 0,
		absentEvidenceSkips: 0,
		boundsSkips: 0,
		insideSkipsByBounds: 0,
		insideCalls: 0,
		insideCallsSameGroup: 0,
		insideCallsCrossGroup: 0,
		insideCallsUndefined: 0,
		insideDecisions: 0,
		overlapCalls: 0,
		overlapCallsSameGroup: 0,
		overlapCallsCrossGroup: 0,
		overlapCallsUndefined: 0,
		overlapDecisions: 0
	};
}


/** The pair's D-12 class as `unionAuthorized` reads it; counting only. */
export function correspondencePairClassOf(
	authorization: CorrespondenceAuthorization,
	predecessorRoomId: string,
	faceKey: string
): CorrespondencePairClass {
	const predecessorKeys = authorization.predecessorComponentKeysByRoomId.get(predecessorRoomId);
	const faceKeyValue = authorization.faceComponentKeyByKey.get(faceKey);
	if (predecessorKeys === undefined || faceKeyValue === undefined) return 'undefined';
	return predecessorKeys.has(faceKeyValue) ? 'same-group' : 'cross-group';
}


export function recordObservationPairClass(
	observation: CorrespondenceObservation,
	pairClass: CorrespondencePairClass
): void {
	observation.pairs += 1;
	if (pairClass === 'same-group') observation.sameGroupPairs += 1;
	else if (pairClass === 'cross-group') observation.crossGroupPairs += 1;
	else observation.undefinedPairs += 1;
}


export function recordInsideCall(
	observation: CorrespondenceObservation,
	pairClass: CorrespondencePairClass
): void {
	observation.insideCalls += 1;
	if (pairClass === 'same-group') observation.insideCallsSameGroup += 1;
	else if (pairClass === 'cross-group') observation.insideCallsCrossGroup += 1;
	else observation.insideCallsUndefined += 1;
}


export function recordOverlapCall(
	observation: CorrespondenceObservation,
	pairClass: CorrespondencePairClass
): void {
	observation.overlapCalls += 1;
	if (pairClass === 'same-group') observation.overlapCallsSameGroup += 1;
	else if (pairClass === 'cross-group') observation.overlapCallsCrossGroup += 1;
	else observation.overlapCallsUndefined += 1;
}
