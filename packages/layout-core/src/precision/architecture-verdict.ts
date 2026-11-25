import { p2311Measure } from '../p2311-perf';
import type { LayoutGeometryIssue } from '../layout-geometry-types';
import type { LayoutDocumentWallFirst } from '../layout-wall-first-types';
import type { WallSamplingDerivation } from '../layout-wall-centerline';
import { createWallSamplingDerivation } from '../layout-wall-centerline';
import { topologyComponentKeyByJunctionId, topologyComponentKeyByWallId } from '../layout-topology-components';
import type { ArchitectureCandidatePatch, WallFirstArchitectureAffectedExtent, WallFirstArchitectureCandidatePair, WallFirstArchitecturePreflightFailure, WallFirstArchitectureProposalIntent, WallFirstArchitectureVerdictScope, WallFirstArchitectureVerdictScopeStats } from './types';
import { validateWallFirstTopology, validateWallFirstTopologyPass } from '../topology/wall-first';
import { architectureCandidatePatch, spliceWallFirstArchitectureCandidate } from './architecture-proposals';
import { architectureIntentTargetIdentity } from './document';
import { guardRoundRoomIntent } from './scalar-edits';

export function wallFirstArchitectureAffectedExtent(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): WallFirstArchitectureAffectedExtent | undefined {
	return architectureCandidateExtent(document, intent)?.extent;
}


/**
 * The patch AND the extent of one intent, derived from the one intent→candidate mapping. The
 * scoped preflight needs both (the splice is built from the patch, the pass is scoped by the
 * extent); deriving them apart would re-run the mapping for no reason.
 */
function architectureCandidateExtent(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): { patch: ArchitectureCandidatePatch; extent: WallFirstArchitectureAffectedExtent } | undefined {
	if (guardRoundRoomIntent(document, intent)) return undefined;
	const patch = architectureCandidatePatch(document, intent);
	if (!patch) return undefined;
	// Conservative on both counts: every centreline override counts as affected even if a
	// future intent forgets to list the Wall, and every Wall incident to a moved Junction
	// follows its endpoint even when the patch rewrote no centreline of its own.
	const affectedWallIds = new Set(patch.affectedWallIds);
	for (const wallId of patch.wallCenterlines.keys()) affectedWallIds.add(wallId);
	const wallIds = document.walls.filter((wall) => affectedWallIds.has(wall.id)).map((wall) => wall.id);
	const junctionIds = document.junctions
		.filter((junction) => patch.junctionPoints.has(junction.id))
		.map((junction) => junction.id);
	return {
		patch,
		extent: {
			junctionIds,
			wallIds,
			wallPairs: candidatePairsInGateOrder(
				document.walls.map((wall) => wall.id),
				topologyComponentKeyByWallId(document),
				new Set(wallIds)
			),
			junctionPairs: candidatePairsInGateOrder(
				document.junctions.map((junction) => junction.id),
				topologyComponentKeyByJunctionId(document),
				new Set(junctionIds)
			)
		}
	};
}


/**
 * Every same-component pair with at least one affected member, in the canonical gate's
 * own order: document order on the first id, then on the second.
 *
 * Enumerated FROM the affected side rather than by scanning every pair, so the walk is
 * bounded by the affected set times the document instead of the document squared, and
 * the output needs no sort: `first` ascends, and for one `first` the second ids are
 * themselves in document order.
 */
function candidatePairsInGateOrder<Key>(
	ids: readonly string[],
	keyById: ReadonlyMap<string, Key>,
	affected: ReadonlySet<string>
): WallFirstArchitectureCandidatePair[] {
	const indexById = new Map(ids.map((id, index) => [id, index] as const));
	const affectedInGateOrder = ids.filter((id) => affected.has(id));
	const pairs: WallFirstArchitectureCandidatePair[] = [];
	for (let first = 0; first < ids.length; first += 1) {
		const firstId = ids[first]!;
		const key = keyById.get(firstId);
		const seconds = affected.has(firstId) ? ids : affectedInGateOrder;
		for (const secondId of seconds) {
			const second = indexById.get(secondId)!;
			if (second <= first) continue;
			if (keyById.get(secondId) !== key) continue;
			pairs.push([firstId, secondId]);
		}
	}
	return pairs;
}


/**
 * One move's AFFECTED-ONLY pass.
 *
 * The SAME stages in the SAME order with the SAME predicates as
 * `validateWallFirstTopology`, evaluated over that move's affected extent alone: the moved
 * Junction pairs, the affected Walls' effective length and self-intersection, the affected Wall
 * pairs' chord classification and crossing. Rooms are skipped (identity-only structure, invariant
 * under a patch) and the Opening set stays deferred, exactly as the preflight defers it.
 *
 * This pass may only run after a CLEAN initialization pass (see the verdict scope): every
 * predicate it does not evaluate was proven not to fail against the frozen baseline, so a pass
 * that finds nothing is `pending`, never `accepted`.
 */
function validateWallFirstArchitectureAffectedCandidate(
	candidate: LayoutDocumentWallFirst,
	extent: WallFirstArchitectureAffectedExtent,
	sampling: WallSamplingDerivation | undefined,
	disableExtentPruneForTest: boolean | undefined
): LayoutGeometryIssue | undefined {
	return p2311Measure('preflight-topology', () =>
		validateWallFirstTopologyPass(candidate, { openingSet: 'defer', sampling, disableExtentPruneForTest, closedContactWallIds: new Set(extent.wallIds) }, {
			wallIds: extent.wallIds,
			wallPairs: extent.wallPairs,
			junctionPairs: extent.junctionPairs,
			evaluateRooms: false
		})
	);
}


export function createWallFirstArchitectureVerdictScope(
	document: LayoutDocumentWallFirst,
	options: { disableExtentPruneForTest?: boolean } = {}
): WallFirstArchitectureVerdictScope {
	let baseline = document;
	let initializedTarget: string | null = null;
	const stats: WallFirstArchitectureVerdictScopeStats = {
		initializations: 0,
		scoped: 0,
		canonical: 0,
		candidates: { walls: 0, wallPairs: 0, junctionPairs: 0 }
	};
	return {
		verdict(document, intent, sampling) {
			if (document !== baseline) {
				// A different document is a different baseline: never reuse a verdict keyed on the old one.
				baseline = document;
				initializedTarget = null;
			}
			const roundHit = guardRoundRoomIntent(baseline, intent);
			if (roundHit) return { code: roundHit.code, message: roundHit.message };
			const prepared = architectureCandidateExtent(baseline, intent);
			if (!prepared) return undefined;
			const candidate = spliceWallFirstArchitectureCandidate(baseline, prepared.patch);
			const target = architectureIntentTargetIdentity(intent);
			if (initializedTarget !== target) {
				// THE INITIALIZATION: today's whole-document preflight, verbatim, on this move.
				const failure = p2311Measure('preflight-topology', () =>
					validateWallFirstTopologyPass(candidate, {
						openingSet: 'defer',
						sampling: sampling ?? createWallSamplingDerivation(),
						disableExtentPruneForTest: options.disableExtentPruneForTest,
						closedContactWallIds: new Set(prepared.patch.affectedWallIds)
					})
				);
				stats.canonical += 1;
				if (failure) return { code: failure.code, message: failure.message };
				initializedTarget = target;
				stats.initializations += 1;
				return undefined;
			}
			stats.scoped += 1;
			stats.candidates.walls += prepared.extent.wallIds.length;
			stats.candidates.wallPairs += prepared.extent.wallPairs.length;
			stats.candidates.junctionPairs += prepared.extent.junctionPairs.length;
			const failure = validateWallFirstArchitectureAffectedCandidate(
				candidate,
				prepared.extent,
				sampling,
				options.disableExtentPruneForTest
			);
			return failure ? { code: failure.code, message: failure.message } : undefined;
		},
		reset() {
			initializedTarget = null;
		},
		stats
	};
}


/**
 * The **cheap canonical prefix** of the direct-edit transaction, for
 * live feedback. It applies the intent's patch and runs exactly one canonical
 * gate — `validateWallFirstTopology(..., { openingSet: 'defer' })`, the stage
 * the planner itself runs before Room reconciliation — then stops.
 *
 * Scope is the point:
 *
 * - it decides **unsupported crossing, self-intersection, duplicate Junction
 *   points, zero-length Walls and broken Room boundary structure** — the
 *   geometric rejections a pointermove can honestly know;
 * - it deliberately does **not** reconcile Rooms, validate the Opening set, the
 *   portal relations or compile, so anything that could only fail there stays
 *   *pending* and is decided by the release planner;
 * - it is **sound by construction**: it is the same function the planner calls
 *   with the same values (the splice preserves every field the gate reads, and
 *   the planner's own re-parse before it is value-preserving), so a failure
 *   here is a failure at release too. A miss is merely pending, never wrong.
 *
 * Returns the canonical issue, or `undefined` when nothing cheap rejects the
 * attempt (including when the intent cannot be derived at all — that is the
 * caller's own "underivable" state, not a verdict here).
 */
export function preflightWallFirstArchitectureCandidate(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent,
	/**
	 * An optional bounded, caller-owned sample scope.
	 *
	 * Omitted (the default) keeps the chain scope exactly: one fresh
	 * derivation per call, never retained across moves. A transient gesture may
	 * instead pass its own gesture-scoped derivation, so the frozen baseline's
	 * untouched Walls — shared by reference through the shallow splice — are not
	 * re-derived on every pointermove. The caller owns termination: `reset()` at
	 * gesture release, cancel, restore or replacement. The scope changes only how
	 * many times an identical artefact is derived, never which artefact the gate
	 * sees, so a `known-invalid` verdict and a `pending` verdict are unchanged.
	 */
	sampling?: WallSamplingDerivation,
	/**
	 * An optional GESTURE-SCOPED VERDICT SET, supplied by the caller (the gesture)
	 * and never silently inside the gate.
	 *
	 * With it, this function returns the scope's verdict: after one clean initialization the same
	 * canonical failure, computed from the same predicates over that move's affected extent only.
	 * Without it, the whole-document path below is exactly what it was — the effect-free default
	 * every other caller and every existing test keeps.
	 */
	verdictScope?: WallFirstArchitectureVerdictScope | null
): WallFirstArchitecturePreflightFailure | undefined {
	if (verdictScope) return verdictScope.verdict(document, intent, sampling);
	const roundHit = guardRoundRoomIntent(document, intent);
	if (roundHit) return { code: roundHit.code, message: roundHit.message };
	const patch = architectureCandidatePatch(document, intent);
	if (!patch) return undefined;
	const candidate = spliceWallFirstArchitectureCandidate(document, patch);
	const failure = p2311Measure('preflight-topology', () =>
		validateWallFirstTopology(candidate, {
			openingSet: 'defer',
			sampling: sampling ?? createWallSamplingDerivation()
		})
	);
	if (!failure) return undefined;
	return { code: failure.code, message: failure.message };
}
