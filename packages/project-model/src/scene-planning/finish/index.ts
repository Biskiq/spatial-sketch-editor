/**
 * Scene Finish and palette planning.
 *
 * One plan function per operation kind, dispatched through a registry over
 * `kinds`. `prepare` is only the composition: it builds the shared context
 * once, then hands it to the plan the requested kind maps to.
 */
import type { DomainPlanner, PlannerRequest } from '../../f4/types';
import type { ShapeIssue } from '../../strict-shape';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../units/source';
import type { ProjectEnvelope } from '../../units/types';
import { createFinishPlanContext, type FinishPlanContext, type Result } from './context';
import {
	SCENE_COLOUR_COAT,
	SCENE_FINISH_ASSIGN,
	SCENE_FINISH_EDIT,
	SCENE_FINISH_FROM_IMAGE,
	SCENE_FINISH_PATCH,
	SCENE_FINISH_REGISTER,
	SCENE_FINISH_REMOVE,
	SCENE_FINISH_RENAME,
	SCENE_PALETTE_ADOPT,
	SCENE_PALETTE_SLOT_ADD,
	SCENE_PALETTE_SLOT_REMOVE,
	SCENE_PALETTE_SLOT_RENAME,
	SCENE_PALETTE_SLOT_SET,
	SCENE_SURFACE_FINISH_ASSIGN,
	kinds,
	type Kind,
} from './kinds';
import {
	planSceneColourCoat,
	planSceneFinishAssign,
	planSceneSurfaceFinishAssign,
} from './plans/assign';
import { planSceneFinishEdit, planSceneFinishPatch } from './plans/edit';
import { planSceneFinishRemove, planSceneFinishRename } from './plans/material';
import {
	planScenePaletteAdopt,
	planScenePaletteSlotAdd,
	planScenePaletteSlotRemove,
	planScenePaletteSlotRename,
	planScenePaletteSlotSet,
} from './plans/palette';
import { planSceneFinishFromImage, planSceneFinishRegister } from './plans/register';
import type { FinishPlannerOptions } from './shared';

/** The one plan function each Finish or palette kind dispatches to. */
const PLANNERS: Record<Kind, (context: FinishPlanContext) => Result> = {
	[SCENE_FINISH_ASSIGN]: planSceneFinishAssign,
	[SCENE_SURFACE_FINISH_ASSIGN]: planSceneSurfaceFinishAssign,
	[SCENE_COLOUR_COAT]: planSceneColourCoat,
	[SCENE_FINISH_EDIT]: planSceneFinishEdit,
	[SCENE_FINISH_REGISTER]: planSceneFinishRegister,
	[SCENE_FINISH_RENAME]: planSceneFinishRename,
	[SCENE_FINISH_REMOVE]: planSceneFinishRemove,
	[SCENE_FINISH_PATCH]: planSceneFinishPatch,
	[SCENE_FINISH_FROM_IMAGE]: planSceneFinishFromImage,
	[SCENE_PALETTE_SLOT_ADD]: planScenePaletteSlotAdd,
	[SCENE_PALETTE_SLOT_SET]: planScenePaletteSlotSet,
	[SCENE_PALETTE_SLOT_RENAME]: planScenePaletteSlotRename,
	[SCENE_PALETTE_SLOT_REMOVE]: planScenePaletteSlotRemove,
	[SCENE_PALETTE_ADOPT]: planScenePaletteAdopt,
};

function prepare(
	request: PlannerRequest<ProjectEnvelope>,
	kind: Kind,
	options: FinishPlannerOptions,
): Result {
	return PLANNERS[kind](createFinishPlanContext(request, kind, options));
}

export function createFinishPlanners(
	options: FinishPlannerOptions = {},
): readonly DomainPlanner<ProjectEnvelope>[] {
	return kinds.map((kind) => ({
		id: `scene.${kind}`,
		kind,
		// `scene-finish-from-image` is the one Finish planner that stages a typed
		// resource: the texture record and its pin are added with the Finish. Every
		// other Finish write stays Scene-only.
		admission: {
			domain: 'scene' as const,
			// Registration may name compile-qualified Layout surfaces as targets it
			// paints, exactly as the surface assignment planner does. Layout is a
			// reference input: the candidate still writes only the Scene unit.
			...(kind === SCENE_SURFACE_FINISH_ASSIGN ||
			kind === SCENE_FINISH_REGISTER ||
			kind === SCENE_COLOUR_COAT
				? { referenceDomains: ['layout'] as const }
				: {}),
			compound: false,
			units: false,
			resources:
				kind === SCENE_FINISH_FROM_IMAGE ||
				kind === SCENE_FINISH_REGISTER ||
				kind === SCENE_FINISH_PATCH ||
				kind === SCENE_FINISH_REMOVE,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare: (request) => prepare(request, kind, options),
	}));
}

/** One diagnostic list for callers that inspect a plan without admitting it. */
export type FinishPlanDiagnostic = ShapeIssue;

export { FINISH_NAME_MAX_LENGTH } from './payload';
export type { FinishPlannerOptions } from './shared';
export type { FinishAssignDerive } from './targets';
export {
	SCENE_COLOUR_COAT,
	SCENE_FINISH_ASSIGN,
	SCENE_FINISH_EDIT,
	SCENE_FINISH_FROM_IMAGE,
	SCENE_FINISH_PATCH,
	SCENE_FINISH_REGISTER,
	SCENE_FINISH_REMOVE,
	SCENE_FINISH_RENAME,
	SCENE_PALETTE_ADOPT,
	SCENE_PALETTE_SLOT_ADD,
	SCENE_PALETTE_SLOT_REMOVE,
	SCENE_PALETTE_SLOT_RENAME,
	SCENE_PALETTE_SLOT_SET,
	SCENE_SURFACE_FINISH_ASSIGN,
};
