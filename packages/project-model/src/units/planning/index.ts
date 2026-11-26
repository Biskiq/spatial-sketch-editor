import { type PlannerRegistry, type PrepareResult } from '../../f4/prepare';
import {
	type AcceptanceSourceAdapter,
	type AcceptedSnapshot,
	type AuthoringIntent,
	type CapturedInput,
	type DomainPlanner,
} from '../../f4/types';
import { createUnitPlannerRegistry } from '../../f4/unit-acceptance';
import {
	createSceneEnvironmentSetPlanner,
	createSceneSkyUpdatePlanner,
} from '../../scene-planning/environment';
import {
	createSceneLookApplyPlanner,
	createSceneTreatmentSetPlanner,
	createSceneLookRestorePlanner,
} from '../../scene-planning/look';
import { createUnitAcceptanceAdapter, createUnitAcceptancePreparation } from '../acceptance';
import { type StagedUnitResource } from '../acceptance-staging';
import {
	createCameraConnectionCreatePlanner,
	createCameraConnectionUpdatePlanner,
} from './camera-connection';
import { createCameraViewUpdatePlanner } from './camera-view';
import { type CaptureBindOptions, createCaptureBindPlanner } from './experience/capture-bind';
import { createExperienceCreatePlanner } from './experience/create';
import {
	createExperienceGuideCreatePlanner,
	createExperienceGuideOrderPlanner,
	createExperienceGuideUpdatePlanner,
	createExperienceGuideRemovePlanner,
} from './experience/guide';
import {
	createExperiencePresentationUpdatePlanner,
	createExperiencePresentationRemovePlanner,
	createExperiencePresentationViewRemovePlanner,
} from './experience/presentation';
import {
	createExperienceStopCreatePlanner,
	createExperienceStopUpdatePlanner,
	createExperienceStopRemovePlanner,
} from './experience/stop';
import { createExperienceUpdatePlanner } from './experience/update';
import { type ProjectEnvelope, type TypedResource } from '../types';

export function createUnitCandidatePlanners(
	options: CaptureBindOptions = {},
): DomainPlanner<ProjectEnvelope>[] {
	return [
		createSceneEnvironmentSetPlanner(),
		createSceneSkyUpdatePlanner(),
		createSceneLookApplyPlanner(),
		createSceneTreatmentSetPlanner(),
		createSceneLookRestorePlanner(),
		createCameraViewUpdatePlanner(),
		createCameraConnectionCreatePlanner(),
		createCameraConnectionUpdatePlanner(),
		createExperienceCreatePlanner(),
		createCaptureBindPlanner(options),
		createExperienceGuideCreatePlanner(),
		createExperienceStopCreatePlanner(),
		createExperienceGuideOrderPlanner(),
		createExperiencePresentationUpdatePlanner(),
		createExperienceStopUpdatePlanner(),
		createExperienceUpdatePlanner(),
		createExperienceGuideUpdatePlanner(),
		createExperienceStopRemovePlanner(),
		createExperiencePresentationViewRemovePlanner(),
		createExperiencePresentationRemovePlanner(),
		createExperienceGuideRemovePlanner(),
	];
}

/** One admission profile for both the planner registry and the source adapter. */
export type UnitAcceptanceProfileOptions = {
	readonly compound?: boolean;
	readonly resourceStaging?: boolean;
	readonly sessionEpoch?: string;
};

export type UnitAcceptanceProfile = {
	readonly registry: PlannerRegistry<ProjectEnvelope>;
	readonly planners: readonly DomainPlanner<ProjectEnvelope>[];
	readonly adapter: AcceptanceSourceAdapter<ProjectEnvelope>;
	prepare(
		snapshot: AcceptedSnapshot<ProjectEnvelope>,
		intent: AuthoringIntent,
		capturedInputs?: readonly CapturedInput[],
	): PrepareResult<ProjectEnvelope>;
};

/**
 * Construct the registry, its planners, the source adapter and the preparation
 * seam from **one** options object.
 *
 * Registering a resource-staging planner against a non-staging adapter (or the
 * reverse) is the wiring defect this factory removes: the profile a host grants
 * is the profile every admission layer reads, so one flag cannot be set in two
 * places and disagree.
 */
export function createUnitAcceptanceProfile(
	options: UnitAcceptanceProfileOptions = {},
): UnitAcceptanceProfile {
	const compound = options.compound === true;
	const resourceStaging = options.resourceStaging === true;
	const planners = createUnitCandidatePlanners({ resourceStaging });
	const registry = createUnitPlannerRegistry<ProjectEnvelope>({ resourceStaging });
	for (const planner of planners) registry.register(planner);
	const preparation = createUnitAcceptancePreparation({
		registry,
		compound,
		resourceStaging,
		...(options.sessionEpoch === undefined ? {} : { sessionEpoch: options.sessionEpoch }),
	});
	return {
		registry,
		planners,
		adapter: createUnitAcceptanceAdapter({ compound, resourceStaging }),
		prepare: preparation.prepare,
	};
}

/** Read-only helper for tests and hosts: the typed resources a captured staging names. */
export function stagedResourcesAsTyped(staged: readonly StagedUnitResource[]): TypedResource[] {
	return staged.map((item) => ({
		kind: item.kind as TypedResource['kind'],
		id: item.id,
		contentRevision: item.contentRevision,
		pin: item.pin,
		unresolved: null,
	}));
}

export {
	CAMERA_CONNECTION_CREATE_KIND,
	CAMERA_CONNECTION_DEFAULT_CLEARANCE,
	CAMERA_CONNECTION_UPDATE_KIND,
	createCameraConnectionCreatePlanner,
	createCameraConnectionUpdatePlanner,
} from './camera-connection';
export { CAMERA_VIEW_UPDATE_KIND, createCameraViewUpdatePlanner } from './camera-view';
export { EXPERIENCE_CAPTURE_BIND_KIND, createCaptureBindPlanner } from './experience/capture-bind';
export type { CaptureBindOptions } from './experience/capture-bind';
export { EXPERIENCE_CREATE_KIND, createExperienceCreatePlanner } from './experience/create';
export {
	EXPERIENCE_GUIDE_CREATE_KIND,
	EXPERIENCE_GUIDE_ORDER_KIND,
	EXPERIENCE_GUIDE_REMOVE_KIND,
	EXPERIENCE_GUIDE_UPDATE_KIND,
	createExperienceGuideCreatePlanner,
	createExperienceGuideOrderPlanner,
	createExperienceGuideRemovePlanner,
	createExperienceGuideUpdatePlanner,
} from './experience/guide';
export {
	EXPERIENCE_PRESENTATION_REMOVE_KIND,
	EXPERIENCE_PRESENTATION_UPDATE_KIND,
	EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
	createExperiencePresentationRemovePlanner,
	createExperiencePresentationUpdatePlanner,
	createExperiencePresentationViewRemovePlanner,
} from './experience/presentation';
export {
	EXPERIENCE_STOP_CREATE_KIND,
	EXPERIENCE_STOP_REMOVE_KIND,
	EXPERIENCE_STOP_UPDATE_KIND,
	createExperienceStopCreatePlanner,
	createExperienceStopRemovePlanner,
	createExperienceStopUpdatePlanner,
} from './experience/stop';
export { EXPERIENCE_UPDATE_KIND, createExperienceUpdatePlanner } from './experience/update';
export {
	SCENE_ENVIRONMENT_CHOICES,
	SCENE_ENVIRONMENT_SET_KIND,
	SCENE_SKY_UPDATE_KIND,
	createSceneEnvironmentSetPlanner,
	createSceneSkyUpdatePlanner,
} from '../../scene-planning/environment';
export type { SceneSkyUpdatePayload } from '../../scene-planning/environment';
export {
	SCENE_LOOK_APPLY_KIND,
	SCENE_LOOK_RESTORE_KIND,
	SCENE_TREATMENT_SET_KIND,
	createSceneLookApplyPlanner,
	createSceneLookRestorePlanner,
	createSceneTreatmentSetPlanner,
} from '../../scene-planning/look';
export type {
	SceneLookApplyPayload,
	SceneLookRestorePayload,
	SceneTreatmentSetPayload,
} from '../../scene-planning/look';
export { STAGED_RESOURCES_INPUT } from './shared';
