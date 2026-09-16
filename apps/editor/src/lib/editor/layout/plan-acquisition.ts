/**
 * `plan-acquisition.ts` — P23.13 S4: owner-aware Plan acquisition (spec §6).
 *
 * Hit *authority* is not entity-class ranking. The ratified order is:
 *
 * > captured gesture → focused control of the selected owner → other eligible
 * > selected-owner controls → current-tool eligible targets → existing entity
 * > fallback
 *
 * A curve point owned by the selected Wall therefore beats an unrelated
 * co-located Opening or Junction, and an active Opening width edge beats its
 * host Wall. Within a tier the choice is nearest screen distance, then
 * canonical identity — never paint order and never an arbitrary tie.
 *
 * This module is the tier engine only: it receives the candidates the caller
 * already decided are *affordable* (drawn, owned, and in a context that reveals
 * them), and answers which one wins. It resolves no geometry, reads no
 * document, and never consults an SVG.
 *
 * Crucially it returns an **authority verdict**, not a hit record. The verdict
 * names a control by canonical identity; the canonical `resolvePlanHit` remains
 * the single place that turns identity into a record, so acquisition changes
 * *which* target wins and never *what* a target means. It also remains the
 * fallback, so an uncontested pointer behaves exactly as before.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import {
	planControlTargetRadiusPx,
	type PlanAcquisitionTier,
	type PlanControlAuthority,
	type PlanControlKind
} from '$lib/layout/plan-control-grammar';

/**
 * Re-exported so editor-side callers have one import site for the control
 * vocabulary while `$lib/layout` remains its single definition (the canonical
 * resolver reads it too, and may not import editor code).
 */
export {
	PLAN_CONTROL_MARKS,
	PLAN_CONTROL_TARGET_COARSE_PX,
	PLAN_CONTROL_TARGET_PX,
	planControlTargetRadiusPx
} from '$lib/layout/plan-control-grammar';
export type {
	PlanAcquisitionTier,
	PlanControlAuthority,
	PlanControlKind
} from '$lib/layout/plan-control-grammar';

/** One affordance the pointer could acquire, described by canonical identity. */
export type PlanControlCandidate = {
	/** Canonical control identity — also the deterministic tie-break. */
	id: string;
	/** The entity that owns this control (Wall / Opening / object / Room). */
	ownerId: string;
	kind: PlanControlKind;
	/** World point of the control's mark. */
	point: LayoutVec2;
	/** A live gesture already captured this control (owner never changes). */
	captured?: boolean;
	/** This control carries the focus ring. */
	focused?: boolean;
	/** Its owner is part of the current selection. */
	ownerSelected?: boolean;
	/** The armed tool may acquire this kind right now. */
	toolEligible?: boolean;
};

export type PlanAcquisitionInput = {
	candidates: readonly PlanControlCandidate[];
	/** World-space pointer position. */
	point: LayoutVec2;
	planView: { pixelsPerMeter: number };
	/** Coarse pointers get the 44 px target where the caller allows it. */
	coarsePointer?: boolean;
	/** Per-candidate radius override (a roomier target for a lone handle). */
	targetRadiusPx?: (candidate: PlanControlCandidate) => number;
};

const TIER_RANK: Record<PlanAcquisitionTier, number> = {
	captured: 0,
	'focused-owner': 1,
	'selected-owner': 2,
	'tool-eligible': 3
};

function screenDistancePx(point: LayoutVec2, candidate: LayoutVec2, pixelsPerMeter: number): number {
	return Math.hypot(point[0] - candidate[0], point[1] - candidate[1]) * pixelsPerMeter;
}

/**
 * Resolve the winning control for a pointer position, or `null` when no tier
 * claims it (the caller then falls through to the canonical entity resolver).
 */
export function resolvePlanAcquisition(
	input: PlanAcquisitionInput
): PlanControlAuthority | null {
	const defaultRadius = planControlTargetRadiusPx(input.coarsePointer === true);
	const tierOf = (candidate: PlanControlCandidate): PlanAcquisitionTier | null => {
		if (candidate.captured) return 'captured';
		if (candidate.focused && candidate.ownerSelected) return 'focused-owner';
		if (candidate.ownerSelected) return 'selected-owner';
		if (candidate.toolEligible) return 'tool-eligible';
		return null;
	};

	let best: PlanControlAuthority | null = null;
	let bestRank = Number.POSITIVE_INFINITY;
	for (const candidate of input.candidates) {
		const tier = tierOf(candidate);
		if (!tier) continue;
		const rank = TIER_RANK[tier];
		const distancePx = screenDistancePx(input.point, candidate.point, input.planView.pixelsPerMeter);
		// A captured control is the gesture's own: it wins on rank alone, even if
		// the pointer has drifted out of its radius mid-drag. Captured ownership
		// never changes mid-gesture (§6).
		if (tier !== 'captured') {
			const radius = input.targetRadiusPx?.(candidate) ?? defaultRadius;
			if (distancePx > radius) continue;
		}
		const better =
			best === null ||
			rank < bestRank ||
			(rank === bestRank &&
				(distancePx < best.distancePx - 1e-9 ||
					(Math.abs(distancePx - best.distancePx) <= 1e-9 &&
						candidate.id.localeCompare(best.id) < 0)));
		if (better) {
			best = { kind: candidate.kind, id: candidate.id, ownerId: candidate.ownerId, tier, distancePx };
			bestRank = rank;
		}
	}
	return best;
}

/** One focused control plus the owner geometry focus/drag reveals (spec §6). */
export type PlanFocusGeometry = {
	/** World center of the focused control's visible mark. */
	point: LayoutVec2;
	/**
	 * Owner control points in canonical order — drawn as the 1 px broken control
	 * polygon. For a straight Wall that is its two endpoints, so the polygon is
	 * the owner's real control net and never a bounding box.
	 */
	controlPoints: readonly LayoutVec2[];
	/**
	 * The owner's true reference centerline from canonical compiled samples
	 * (`CompiledPhysicalWall.solidCenterlinePolylines`). A curve keeps its curve
	 * here; the overlay never substitutes a chord.
	 */
	centerline: readonly LayoutVec2[];
};

/**
 * Resolve the focus/drag overlay geometry for one focused control, or `null`
 * when the owner cannot supply canonical geometry — then nothing is drawn,
 * because the overlay must never invent a centerline.
 *
 * Pure: no document, no transients, no paint. The caller passes live data it
 * already has.
 */
export function planFocusGeometry(
	focus: { ownerId: string; point?: LayoutVec2 } | null,
	compiledWalls: readonly {
		wallId: string;
		solidCenterlinePolylines: readonly (readonly LayoutVec2[])[];
	}[]
): PlanFocusGeometry | null {
	if (!focus) return null;
	const wall = compiledWalls.find((candidate) => candidate.wallId === focus.ownerId);
	if (!wall) return null;
	const centerline = wall.solidCenterlinePolylines.flat().map((point) => [...point] as LayoutVec2);
	if (centerline.length < 2) return null;
	return {
		point: focus.point ? ([...focus.point] as LayoutVec2) : centerline[0],
		controlPoints: [centerline[0], centerline[centerline.length - 1]],
		centerline
	};
}
