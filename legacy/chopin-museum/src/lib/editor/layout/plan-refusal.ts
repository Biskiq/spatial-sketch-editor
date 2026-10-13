/**
 * `plan-refusal.ts` — P23.13 S8 / §6 + §7: how long a refusal stays on the
 * drawing, and what it looks like while it does.
 *
 * The P23.11 transient contract already guarantees the important half: a refused
 * release installs nothing, restores the frozen baseline, and writes no history,
 * so the original geometry keeps its committed position, ink and opacity by
 * construction. What it did not have was a *lifetime* for the mark itself: the
 * refused attempt's stop/× lived exactly as long as the drag that produced it,
 * and the moment the pointer came up the drawing forgot the refusal entirely —
 * leaving only a status line in the Inspector, which is not where the eye is.
 *
 * So this module owns the bounded-feedback lifetime §2 partitions out:
 *
 * ```text
 * refusal          → one annotation at the refused attempt's own locus
 * ~1.2 s           → it expires on its own
 * next deliberate
 * action / Escape  → it clears immediately
 * ```
 *
 * Three rules keep it honest:
 *
 * 1. **The locus is the attempt's, never the pointer's.** A refused Junction
 *    move marks where the Junction was asked to go, so the mark explains the
 *    refusal instead of trailing the cursor.
 * 2. **It is render-only.** The annotation is primitives pushed into the
 *    overlay's `drafts`/`labels`; nothing here reads or writes a document, and
 *    no hit, snap, measurement or validation path can see it.
 * 3. **Silence stays silent.** A refusal with no message (the planner's own
 *    `no_op`) produces no annotation at all rather than an unexplained mark —
 *    the same rule `releaseArchitectureEdit` already applies to the status line.
 */
import type { LayoutVec2 } from '$lib/layout/layout-types';
import { geometryId } from '$lib/layout/layout-geometry-types';
import type { PlanInteractionProjection, PlanRenderPrimitive } from '$lib/layout/plan-render-model';

/**
 * Spec §2's bounded-feedback lifetime: the refused proposal persists "~1.2 s or
 * until the next deliberate action". Long enough to be read after the release
 * that caused it, short enough to be gone before the next gesture starts.
 */
export const PLAN_REFUSAL_PERSISTENCE_MS = 1200;

/** The local reason sits clear of the stop mark (7 px radius) plus a text line. */
export const PLAN_REFUSAL_REASON_OFFSET_PX = 15;

/** Octagonal stop radius — the same mark the live invalid proposal paints (§6). */
const PLAN_REFUSAL_STOP_RADIUS_PX = 7;

export type PlanRefusalKind =
	/** A refused direct Wall/Junction/curve/Bend gesture. */
	| 'architecture-edit'
	/** A refused canonical Opening drag (out of fit, or the planner's own refusal). */
	| 'opening-drag';

/**
 * One persisted refusal.
 *
 * `ownerKey` is the canonical identity the refusal belongs to (a Wall, a
 * Junction, an Opening) so a later edit of the *same* entity can be told from an
 * unrelated one; the viewport clears on the next deliberate action regardless,
 * which is why this stays a small derived record rather than a registry.
 */
export type PlanRefusal = {
	kind: PlanRefusalKind;
	/** World locus of the refused attempt. */
	locus: LayoutVec2;
	/** The reason the canonical planner gave, or `null` when it stayed silent. */
	reason: string | null;
	/** Wall clock (ms) the refusal was recorded; the lifetime runs from here. */
	startedAtMs: number;
	ownerKey: string;
};

/**
 * Record a refusal. Returns `null` when there is nothing to persist: no locus to
 * mark it at, or no reason to give — a mark with no explanation is worse than no
 * mark, because it says "something was refused" and then answers nothing.
 */
export function beginPlanRefusal(input: {
	kind: PlanRefusalKind;
	locus: LayoutVec2 | null;
	reason: string | null;
	atMs: number;
	ownerKey: string;
}): PlanRefusal | null {
	if (!input.locus || !input.reason) return null;
	return {
		kind: input.kind,
		locus: [...input.locus] as LayoutVec2,
		reason: input.reason,
		startedAtMs: input.atMs,
		ownerKey: input.ownerKey
	};
}

/**
 * The refusal as it stands at `nowMs`, or `null` once its lifetime has run out.
 * Expiry is a pure function of the clock so a caller cannot resurrect an old mark
 * by re-reading it, and so a test can walk the lifetime without a timer.
 */
export function planRefusalAt(refusal: PlanRefusal | null, nowMs: number): PlanRefusal | null {
	if (!refusal) return null;
	const age = nowMs - refusal.startedAtMs;
	if (!Number.isFinite(age) || age < 0) return refusal;
	return age < PLAN_REFUSAL_PERSISTENCE_MS ? refusal : null;
}

/** How much of the lifetime is left, in ms (0 once expired). */
export function planRefusalRemainingMs(refusal: PlanRefusal | null, nowMs: number): number {
	const active = planRefusalAt(refusal, nowMs);
	if (!active) return 0;
	return Math.max(0, PLAN_REFUSAL_PERSISTENCE_MS - (nowMs - active.startedAtMs));
}

/**
 * Paint one persisted refusal.
 *
 * Draft-layer primitives carry the mark; the reason is a label so it gets the
 * text layer's knockout and stays legible over a Wall band — the same split the
 * dimension instrument and the snap relation word already use.
 */
export function withPlanRefusalAnnotation(
	projection: PlanInteractionProjection,
	refusal: PlanRefusal | null
): PlanInteractionProjection {
	if (!refusal) return projection;
	const key = (name: string): string => geometryId(['plan', 'overlay', 'refusal', name, refusal.ownerKey]);
	const drafts: PlanRenderPrimitive[] = [
		{
			kind: 'circle',
			key: key('stop'),
			center: refusal.locus,
			radiusPx: PLAN_REFUSAL_STOP_RADIUS_PX,
			shape: 'octagon',
			style: 'refusal-stop'
		},
		{
			kind: 'circle',
			key: key('cross'),
			center: refusal.locus,
			radiusPx: PLAN_REFUSAL_STOP_RADIUS_PX,
			shape: 'cross',
			style: 'refusal-cross'
		}
	];
	const labels: PlanRenderPrimitive[] = refusal.reason
		? [
				{
					kind: 'text',
					key: key('reason'),
					anchor: refusal.locus,
					text: refusal.reason,
					offsetPx: [0, -PLAN_REFUSAL_REASON_OFFSET_PX],
					style: 'refusal-reason'
				}
			]
		: [];
	return {
		...projection,
		drafts: [...projection.drafts, ...drafts],
		labels: [...projection.labels, ...labels]
	};
}
