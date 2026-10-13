/**
 * `plan-control-grammar.ts` — P23.13 S4: the shared Plan control vocabulary.
 *
 * This is the *naming* half of spec §6's control table, split out so the
 * canonical hit resolver (`plan-hit`) and the owner-aware acquisition engine
 * (`plan-acquisition`) agree on control kinds, mark shapes and acquisition
 * sizes without the resolver having to import editor-side code.
 *
 * It holds no geometry, no resolution and no browser coupling: a control kind,
 * the shape that identifies it, the radius its mark is drawn at, and the
 * minimum pointer target that may acquire it. Everything in here is a *tuning
 * value*, never document semantics.
 */

/**
 * Pointer hit targets are at least 24×24 px (spec §6), and 44×44 on a coarse
 * pointer where space allows. These are *acquisition* radii: a control's
 * visible mark stays its ratified size (7 px diamond, 8 px circle, …), so the
 * affordance never grows into clutter in order to become clickable.
 */
export const PLAN_CONTROL_TARGET_PX = 24;
export const PLAN_CONTROL_TARGET_COARSE_PX = 44;

export function planControlTargetRadiusPx(coarsePointer: boolean): number {
	return (coarsePointer ? PLAN_CONTROL_TARGET_COARSE_PX : PLAN_CONTROL_TARGET_PX) / 2;
}

/** Every control a Plan pointer or keyboard can focus (spec §6 table). */
export type PlanControlKind =
	| 'junction'
	| 'curve-control'
	| 'opening-edge'
	| 'opening-slide'
	| 'object-rotation'
	| 'room-rotation';

/**
 * The visible mark for each control. Shape is the non-colour identity, so it is
 * data the paint layer obeys rather than a class name the paint layer guesses;
 * this is what keeps a Junction diamond, an Opening width square and a curve
 * bend circle distinguishable in grayscale. A kind absent from the table draws
 * no mark of its own (the Opening slide grip is a paired polyline).
 */
export const PLAN_CONTROL_MARKS = {
	/** Filled 7 px diamond. */
	junction: { shape: 'diamond', radiusPx: 3.5 },
	/** Hollow 8 px circle; fills when active. */
	'curve-control': { shape: 'circle', radiusPx: 4 },
	/** 7 px square straddling the jamb. */
	'opening-edge': { shape: 'square', radiusPx: 3.5 }
} as const satisfies Partial<
	Record<PlanControlKind, { shape: 'circle' | 'diamond' | 'square'; radiusPx: number }>
>;

export type PlanAcquisitionTier = 'captured' | 'focused-owner' | 'selected-owner' | 'tool-eligible';

/**
 * The winning control, named by canonical identity rather than by a hit record:
 * acquisition decides *which* target wins, and the canonical resolver still
 * decides *what* that target means.
 */
export type PlanControlAuthority = {
	kind: PlanControlKind;
	/** Canonical control identity (also the deterministic tie-break). */
	id: string;
	/** The entity that owns this control (Wall / Opening / object / Room). */
	ownerId: string;
	tier: PlanAcquisitionTier;
	/** Measured screen distance from the pointer to the control's mark. */
	distancePx: number;
};
