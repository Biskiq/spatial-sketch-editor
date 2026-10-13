/**
 * `layout-wall-chain-closure.ts` — P23.13 S8 / §7: the canonical evidence behind
 * a closure cue.
 *
 * §7's rule is narrow and absolute: a candidate closure may show the faint Room
 * face **only** when the canonical candidate actually yields one; otherwise the
 * cue must say `Close at junction` and promise no Room at all. That is a
 * question only the canonical planner can answer, so this module asks it
 * instead of guessing:
 *
 * ```text
 * closing leg → planWallSegment(baseline, currentStart, runStart)  // the same
 *                                                                  // entry the
 *                                                                  // commit uses
 * lineage      → the Rooms that plan itself created
 * room polygon → that Room's own canonical boundary
 * ```
 *
 * Nothing is installed and nothing is mutated: the planner returns a plan value,
 * the baseline is the caller's own frozen document, and the polygons come from
 * the plan's document through the same `roomBoundaryPolygon` the compiler and
 * the room-reconciliation engine use. A presentation-side enclosure test (shoelace
 * area, "the polygon looks closed", a proximity threshold) would be a second
 * geometry truth standing in for the planner's verdict — the exact thing this
 * slice is forbidden to add.
 *
 * Partition runs are handed back with no face by construction: a partition never
 * births a Room, so its cue can only ever be the junction copy.
 */
import {
	planWallSegment,
	roomBoundaryPolygon,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallRole
} from '@portfolio/layout-core';

export type PlanClosureEvidence = {
	/** True when the closing leg's own canonical plan creates a Room. */
	yieldsFace: boolean;
	/** The created face(s) as canonical boundary polygons, for the closure wash. */
	faces: readonly (readonly LayoutVec2[])[];
};

/**
 * Plan the closing leg and report the face it would create, or an empty result
 * when the plan rejects (off-fit, degenerate, collinear, self-intersecting —
 * every refusal is "no face", and the cue then says `Close at junction`).
 *
 * `height` is passed through exactly as the commit path passes it: the probe must
 * plan the operation the click would perform, so a run that carries its own
 * continuation height gets the same birth semantics here as at release.
 */
export function wallChainClosureEvidence(input: {
	/** The frozen canonical document the run is being drawn against. */
	baseline: LayoutDocumentWallFirst;
	/** The run's current start (the live leg's start junction point). */
	start: LayoutVec2;
	/** The run's own start junction point — the candidate endpoint. */
	end: LayoutVec2;
	role: LayoutWallRole;
	/** The run's continuation height, when it carries one. */
	height?: number;
	/**
	 * P23B.3a S6 — DECLARED anchors for the closing leg: the live leg's start
	 * Junction and the run's start Junction. A closure is the run EXTENDING its
	 * own group (operation class 3), so the probe plans it the same way the commit
	 * does — with the identities the run owns — instead of relying on the
	 * coordinates happening to coincide, which the policy no longer honours.
	 */
	startJunctionId?: string | null;
	runStartJunctionId?: string | null;
}): PlanClosureEvidence {
	const declaredJunctionSnaps = [
		...(input.startJunctionId ? [{ pointIndex: 0, junctionId: input.startJunctionId }] : []),
		...(input.runStartJunctionId ? [{ pointIndex: 1, junctionId: input.runStartJunctionId }] : [])
	];
	const plan = planWallSegment({
		baseline: input.baseline,
		start: [...input.start] as LayoutVec2,
		end: [...input.end] as LayoutVec2,
		role: input.role,
		...(input.height !== undefined ? { height: input.height } : {}),
		...(declaredJunctionSnaps.length > 0 ? { endpointJunctionSnaps: declaredJunctionSnaps } : {})
	});
	if (plan.kind === 'rejected') return { yieldsFace: false, faces: [] };
	const faces: LayoutVec2[][] = [];
	for (const record of plan.lineage) {
		const polygon = roomBoundaryPolygon(plan.document, record.roomId);
		if (polygon && polygon.length > 2) {
			faces.push(polygon.map((point) => [...point] as LayoutVec2));
		}
	}
	return { yieldsFace: faces.length > 0, faces };
}

/**
 * Gesture-lifetime memo key for one closure probe.
 *
 * Closure is an *identity* outcome (P23.9: `endJunctionId === runStartJunctionId`),
 * so while the pointer stays on the run's start junction the closing leg — and
 * therefore its face — is the same leg. Keying the probe on the canonical
 * identities plus the run's role/height lets the caller plan once per closure
 * rather than once per pointermove, without ever caching a *coordinate* answer:
 * a different start junction is a different key by construction.
 */
export function wallChainClosureProbeKey(input: {
	startJunctionId: string | null;
	start: LayoutVec2;
	runStartJunctionId: string | null;
	end: LayoutVec2;
	role: LayoutWallRole;
	height: number | null;
}): string {
	const startId = input.startJunctionId ?? `pt:${input.start[0]},${input.start[1]}`;
	const endId = input.runStartJunctionId ?? `pt:${input.end[0]},${input.end[1]}`;
	return [startId, endId, input.role, input.height ?? 'default'].join('|');
}
