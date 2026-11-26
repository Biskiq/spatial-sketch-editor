/** Shared Finish planning vocabulary: recipes, naming and record grants. */

import { type PlannerRequest } from '../../f4/types';
import { type MaterialDigestProof } from '../../materials/proof';
import { type Recipe, type TargetAnalysis } from '../../materials/types';
import { type MaterialId } from '../../scene';
import { type Result } from './context';
import { type FinishNameContext, type FinishTreatmentFacts } from './treatment';
import { type SceneRecordScope } from '../record-scope';
import {
	type CameraFreeSceneDocument as SceneDocument,
	type ProjectEnvelope,
} from '../../units/types';

export const MATERIAL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HEX_COLOR = /^#[0-9a-f]{6}$/;

export function materialRecipesOf(envelope: ProjectEnvelope): ReadonlyMap<string, Recipe> {
	return new Map(
		envelope.units.resources.data.resources
			.filter((resource) => resource.kind === 'material' && resource.material !== undefined)
			.map((resource) => [resource.id, resource.material!.recipe]),
	);
}

export type FinishPlannerOptions = {
	/** The catalogue's display label, e.g. `Walnut Wood`; identity is its id. */
	readonly labelForMaterial?: (materialId: MaterialId) => string;
	/**
	 * The ingress proof for new material definitions. A provider is re-read per
	 * preparation because a long-lived planner outlives one source session; the
	 * proof itself is content-addressed and immutable. Absent, no new definition
	 * is admitted.
	 */
	readonly materialProof?: (request: PlannerRequest<ProjectEnvelope>) => MaterialDigestProof;
	/**
	 * Host-owned target analysis for the exact source revision.
	 *
	 * Registration names targets; it never proves what their geometry can sample.
	 * The host derives facts from the exact shipped native shape, the exact Layout
	 * surface or the exact approved model derivative, bound to the revision it
	 * inspected. F4 matches the caller's facts against this analysis and refuses
	 * stale, absent or incompatible facts. Absent, no registration with a target
	 * is admitted: caller assertions are never a substitute.
	 */
	readonly targetAnalysis?: TargetAnalysis;
	/**
	 * Presentation facts for generated Finish names: a Finish named
	 * `<material> · <treatment>` is renamed with its treatment while its name
	 * is still the generated one. Absent, patch and palette names keep the
	 * prior rule (`nextFinishName` on copies, names never regenerate).
	 */
	readonly treatmentFacts?: FinishTreatmentFacts;
};

export function refuse(message: string, code = 'invalid-value'): Result {
	return { kind: 'rejected', code, message, diagnostics: [] };
}

export function labelOf(options: FinishPlannerOptions, materialId: MaterialId): string {
	return options.labelForMaterial?.(materialId) ?? materialId;
}

export function nameContextOf(
	options: FinishPlannerOptions,
	recipes: ReadonlyMap<string, Recipe>,
	palette: SceneDocument['palette'],
): FinishNameContext {
	return {
		recipes,
		...(palette === undefined ? {} : { palette }),
		facts: { ...options.treatmentFacts, labelForMaterial: (id) => labelOf(options, id) },
	};
}

export type MaterialGrant = NonNullable<SceneRecordScope['materials']>;

export function allocationOf(
	request: PlannerRequest<ProjectEnvelope>,
	allowedKinds: readonly string[],
	required: boolean,
): { readonly id: string | null } | { readonly missing: string } {
	const allocations = request.allocatedIds;
	if (allocations.length === 0) {
		return required ? { missing: 'This operation needs one allocated id.' } : { id: null };
	}
	if (allocations.length !== 1 || !allowedKinds.includes(allocations[0]!.kind)) {
		return { missing: `This operation takes one allocated ${allowedKinds.join(' or ')} id.` };
	}
	return { id: allocations[0]!.id };
}
