/**
 * The Look Treatment: a resolve-time parameter change, never a rewrite.
 *
 * A Treatment runs inside the one shared material resolver, after a Finish has
 * resolved, so the Stage, Visitor Preview and a published visit all read the
 * same values. It never touches the authored document: switching a Treatment
 * changes what is drawn, not what is stored.
 *
 * The constants are render defaults under O5. They may be retuned freely until
 * S6 exposes the Treatment control; after that the catalogue rule freezes them,
 * because a release renders through current code and a changed look needs a new
 * treatment id.
 */
import type { MaterialTextureSlot } from '$lib/types/materials';
import {
	CLAY_COLOR,
	CLAY_ROUGHNESS,
	FLAT_MIN_ROUGHNESS,
	type MaterialTreatment
} from '$lib/render/resources/material-descriptor';

// The frozen values live in the dependency-free descriptor module so the one
// material store can read them; resolve-time callers import them from here.
export { CLAY_COLOR, CLAY_ROUGHNESS, FLAT_MIN_ROUGHNESS };

/** One Finish's resolved render values, before and after a Treatment. */
export type TreatmentSubject = {
	readonly color: string;
	readonly roughness: number;
	readonly metalness: number;
	readonly slotUris: Partial<Record<MaterialTextureSlot, string>>;
	readonly normalScale: readonly [number, number] | null;
};

/**
 * Apply one Treatment to resolved values. Natural (absent) returns the subject
 * unchanged — same object, so an untreatment surface cannot be mutated by
 * accident. Both treatments drop every map, because a stylised look is not a
 * textured one.
 */
export function applyTreatment(
	treatment: MaterialTreatment | undefined,
	subject: TreatmentSubject
): TreatmentSubject {
	if (treatment === undefined) return subject;
	if (treatment === 'clay') {
		return {
			color: CLAY_COLOR,
			roughness: CLAY_ROUGHNESS,
			metalness: 0,
			slotUris: {},
			normalScale: null
		};
	}
	return {
		color: subject.color,
		roughness: Math.max(subject.roughness, FLAT_MIN_ROUGHNESS),
		metalness: 0,
		slotUris: {},
		normalScale: null
	};
}
