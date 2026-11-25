import { type DomainPlanner } from '../f4/types';
import { type SceneSky, type SceneTreatment } from '../scene';
import { buildEnvironment, sceneWithEnvironment, sameEnvironment, unitSceneCandidate } from './environment';
import { ShapeReader } from '../strict-shape';
import { sceneLookPaletteSlots, sceneLookStart } from '../units/look-presets';
import { prepared } from '../units/planning/experience/update';
import { refuse, envelopeOf } from '../units/planning/shared';
import { sameSky, SCENE_SKY_DEFAULT } from '../units/sky-presets';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../units/source';
import { SCENE_TREATMENTS, type ProjectEnvelope } from '../units/types';
import { validateSceneSky } from '../units/validate';

export const SCENE_LOOK_APPLY_KIND = 'scene-look-apply';
export const SCENE_TREATMENT_SET_KIND = 'scene-treatment-set';
export const SCENE_LOOK_RESTORE_KIND = 'scene-look-restore';

export type SceneLookApplyPayload = { readonly look: string };

export type SceneTreatmentSetPayload = {
	readonly treatment: 'natural' | SceneTreatment;
};

export type SceneLookRestorePayload = {
	readonly sky: SceneSky | null;
	readonly treatment?: SceneTreatment;
};

/**
 * `scene-look-apply` installs a curated Look as one authored change: the Look's
 * Sky with the World's noon heading kept, its Treatment, and its palette only
 * when the World has no palette yet. It never touches a Finish assignment or a
 * light, so no surface recolours until `scene-palette-adopt` is asked for.
 */
export function createSceneLookApplyPlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: `unit.${SCENE_LOOK_APPLY_KIND}`,
		kind: SCENE_LOOK_APPLY_KIND,
		admission: { domain: 'scene', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			if (request.intent.targets.length !== 0) {
				return refuse('unsupported-operation', `${SCENE_LOOK_APPLY_KIND} takes no targets`);
			}
			const scene = envelopeOf(request).units.scene.data;
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', ['look']);
			const id = payload === null ? null : reader.string(payload.look, '$.payload.look');
			if (payload === null || id === null || reader.issues.length !== 0) {
				return refuse('invalid-payload', 'Choose one of the Looks', reader.issues);
			}
			const look = sceneLookStart(id);
			if (look === null) return refuse('unknown-look', 'That Look is not in this catalogue.');

			const previous = scene.environment;
			const heading = previous?.sky?.heading ?? SCENE_SKY_DEFAULT.heading;
			const sky: SceneSky = { ...look.atmosphere, heading, moon: { ...look.atmosphere.moon } };
			const valid = validateSceneSky(sky);
			if (!valid.success) {
				return refuse('invalid-payload', 'The Look atmosphere is not a valid Sky', valid.issues);
			}
			const treatment = look.treatment;
			const seedsPalette =
				(scene.palette === undefined || scene.palette.length === 0) && look.palette.length > 0;
			if (!seedsPalette && sameEnvironment(previous, buildEnvironment(valid.value, treatment))) {
				return refuse('no-change', 'The World already uses this Look.');
			}

			let data = sceneWithEnvironment(scene, valid.value, treatment);
			if (seedsPalette) data = { ...data, palette: [...sceneLookPaletteSlots(look)] };
			return prepared(
				request,
				unitSceneCandidate(request, data),
				[{
					kind: 'scene.look.applied',
					subjectIds: [],
					fields: seedsPalette ? ['environment', 'palette'] : ['environment']
				}],
				[]
			);
		}
	};
}

/** `scene-treatment-set` changes only the resolve-time Treatment, keeping the Sky. */
export function createSceneTreatmentSetPlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: `unit.${SCENE_TREATMENT_SET_KIND}`,
		kind: SCENE_TREATMENT_SET_KIND,
		admission: { domain: 'scene', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			if (request.intent.targets.length !== 0) {
				return refuse('unsupported-operation', `${SCENE_TREATMENT_SET_KIND} takes no targets`);
			}
			const scene = envelopeOf(request).units.scene.data;
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', ['treatment']);
			const choice =
				payload === null
					? null
					: reader.tag(payload.treatment, '$.payload.treatment', ['natural', ...SCENE_TREATMENTS]);
			if (payload === null || choice === null || reader.issues.length !== 0) {
				return refuse('invalid-payload', 'Choose Natural, Flat colour or Clay', reader.issues);
			}
			const treatment: SceneTreatment | undefined =
				choice === 'natural' ? undefined : (choice as SceneTreatment);
			const previous = scene.environment;
			if (previous?.treatment === treatment) {
				return refuse('no-change', 'The World already uses this Treatment.');
			}
			const data = sceneWithEnvironment(scene, previous?.sky ?? null, treatment);
			return prepared(
				request,
				unitSceneCandidate(request, data),
				[{ kind: 'scene.environment.updated', subjectIds: [], fields: ['environment'] }],
				[]
			);
		}
	};
}

/** `scene-look-restore` puts back one captured environment for Previous (A/B). */
export function createSceneLookRestorePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: `unit.${SCENE_LOOK_RESTORE_KIND}`,
		kind: SCENE_LOOK_RESTORE_KIND,
		admission: { domain: 'scene', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			if (request.intent.targets.length !== 0) {
				return refuse('unsupported-operation', `${SCENE_LOOK_RESTORE_KIND} takes no targets`);
			}
			const scene = envelopeOf(request).units.scene.data;
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', ['sky', 'treatment']);
			if (payload === null) return refuse('invalid-payload', 'A saved environment is required', reader.issues);

			let sky: SceneSky | null = null;
			if (payload.sky !== null) {
				const valid = validateSceneSky(payload.sky);
				if (!valid.success) {
					return refuse('invalid-payload', 'The saved Sky is not valid', valid.issues);
				}
				sky = sameSky(valid.value, SCENE_SKY_DEFAULT) ? null : valid.value;
			}
			let treatment: SceneTreatment | undefined;
			if (payload.treatment !== undefined) {
				const tag = reader.tag(payload.treatment, '$.payload.treatment', [...SCENE_TREATMENTS]);
				if (tag === null) {
					return refuse('invalid-payload', 'The saved Treatment is not valid', reader.issues);
				}
				treatment = tag as SceneTreatment;
			}
			if (reader.issues.length !== 0) {
				return refuse('invalid-payload', 'The saved environment is not valid', reader.issues);
			}
			const next = buildEnvironment(sky, treatment);
			if (sameEnvironment(scene.environment, next)) {
				return refuse('no-change', 'That Environment is already in place.');
			}
			const data = sceneWithEnvironment(scene, sky, treatment);
			return prepared(
				request,
				unitSceneCandidate(request, data),
				[{ kind: 'scene.look.restored', subjectIds: [], fields: ['environment'] }],
				[]
			);
		}
	};
}
