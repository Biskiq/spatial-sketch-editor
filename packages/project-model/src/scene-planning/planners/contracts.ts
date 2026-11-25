import type { PlannerAdmission } from '../../f4/types';
import type { NormalizedPlacementDefinition } from '../types';

/**
 * Every Scene planner except `place-object` changes Scene only.
 *
 * `place-object` is the **single** planner granted typed-resource staging: a
 * creator model's first placement installs its `model` resource, exact lock and
 * entity in one accepted result. No other Scene operation may write resources,
 * and the host's own admission must grant staging independently.
 */
export const SCENE_PLANNER_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: false,
	units: false,
	resources: false
});


/** A-3: `delete-one` is the only Scene operation that also writes Experience. */
export const SCENE_DELETE_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: true,
	writes: ['experience'] as const,
	units: false,
	resources: false
});


export const SCENE_PLACEMENT_ADMISSION: PlannerAdmission = Object.freeze({
	domain: 'scene',
	compound: false,
	units: false,
	resources: true
});


export type ScenePlannerOptions = {
	/**
	 * The host's admitted normalized definitions, captured before planning. An
	 * empty list admits no new placement; existing-object operations still work.
	 *
	 * A provider is re-read for every preparation: a creator model's definitions
	 * come from the currently accepted envelope and are only known after an
	 * import, while the planner registration outlives it. The intent still carries
	 * the captured `metadataContentId`, so a changed set refuses
	 * (`definition-changed`) instead of placing a different object.
	 */
	readonly definitions?:
		| readonly NormalizedPlacementDefinition[]
		| (() => readonly NormalizedPlacementDefinition[]);
};
