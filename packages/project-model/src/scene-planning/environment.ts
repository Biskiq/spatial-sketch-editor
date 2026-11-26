import { type DomainPlanner, type PlannerRequest } from '../f4/types';
import { type SceneEnvironment, type SceneSky, type SceneTreatment } from '../scene';
import { ShapeReader } from '../strict-shape';
import { prepared } from '../units/planning/experience/update';
import { refuse, envelopeOf } from '../units/planning/shared';
import { sameSky, SCENE_SKY_DEFAULT, skyFromPreset } from '../units/sky-presets';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../units/source';
import {
	SCENE_SKY_PRESETS,
	type SceneEnvironmentChoice,
	type ProjectEnvelope,
} from '../units/types';
import { validateSceneSky } from '../units/validate';

export const SCENE_ENVIRONMENT_SET_KIND = 'scene-environment-set';
export const SCENE_SKY_UPDATE_KIND = 'scene-sky-update';
export const SCENE_ENVIRONMENT_CHOICES: readonly SceneEnvironmentChoice[] = SCENE_SKY_PRESETS;

export type SceneSkyUpdatePayload = Partial<Omit<SceneSky, 'preset' | 'moon'>> & {
	moon?: Partial<SceneSky['moon']>;
};

export function createSceneEnvironmentSetPlanner(): DomainPlanner<ProjectEnvelope> {
	return createSkyPlanner(SCENE_ENVIRONMENT_SET_KIND);
}

export function createSceneSkyUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return createSkyPlanner(SCENE_SKY_UPDATE_KIND);
}

export function createSkyPlanner(
	kind: typeof SCENE_ENVIRONMENT_SET_KIND | typeof SCENE_SKY_UPDATE_KIND,
): DomainPlanner<ProjectEnvelope> {
	const settingPreset = kind === SCENE_ENVIRONMENT_SET_KIND;
	return {
		id: `unit.${kind}`,
		kind,
		admission: { domain: 'scene', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			if (request.intent.targets.length !== 0) {
				return refuse('unsupported-operation', `${kind} takes no targets`);
			}
			const envelope = envelopeOf(request);
			const sceneUnit = envelope.units.scene;
			const { environment, ...scene } = sceneUnit.data;
			const previous = environment?.sky ?? SCENE_SKY_DEFAULT;
			const reader = new ShapeReader();
			const payload = reader.object(
				request.intent.payload,
				'$.payload',
				settingPreset
					? ['preset']
					: [
							'time',
							'heading',
							'arcHeight',
							'haze',
							'exposure',
							'softness',
							'sunShadows',
							'moon',
							'skyColor',
							'groundColor',
						],
			);
			if (payload === null || Object.keys(payload).length === 0 || reader.issues.length !== 0) {
				return refuse('invalid-payload', 'Choose a preset or supply a Sky change', reader.issues);
			}

			let next: unknown;
			if (settingPreset) {
				const preset = SCENE_SKY_PRESETS.find((choice) => choice === payload.preset);
				if (preset === undefined) return refuse('invalid-payload', 'Choose one of the Sky presets');
				next = skyFromPreset(preset, previous.heading);
			} else {
				if (previous.preset === 'studio' && Object.keys(payload).some((key) => key !== 'heading')) {
					return refuse('unsupported-operation', 'Studio only accepts a heading change');
				}
				let moon = previous.moon;
				if ('moon' in payload) {
					const patch = reader.object(payload.moon, '$.payload.moon', ['color', 'strength']);
					if (patch === null || Object.keys(patch).length === 0 || reader.issues.length !== 0) {
						return refuse('invalid-payload', 'Supply a Moon colour or strength', reader.issues);
					}
					moon = { ...moon, ...patch };
				}
				next = { ...previous, ...payload, moon };
			}

			const result = validateSceneSky(next);
			if (!result.success) return refuse('invalid-payload', 'Invalid Sky settings', result.issues);
			if (sameSky(previous, result.value))
				return refuse('no-change', 'The World already uses this Sky');

			const treatment = environment?.treatment;
			const sky = sameSky(result.value, SCENE_SKY_DEFAULT) ? undefined : result.value;
			const data = {
				...scene,
				...(sky === undefined && treatment === undefined
					? {}
					: {
							environment: {
								...(sky === undefined ? {} : { sky }),
								...(treatment === undefined ? {} : { treatment }),
							},
						}),
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: { ...envelope.units, scene: { header: { ...sceneUnit.header }, data } },
			};
			return prepared(
				request,
				candidate,
				[
					{
						kind: 'scene.environment.updated',
						subjectIds: [],
						fields: ['environment'],
					},
				],
				[],
			);
		},
	};
}

export type SceneData = ProjectEnvelope['units']['scene']['data'];

export function buildEnvironment(
	sky: SceneSky | null,
	treatment: SceneTreatment | undefined,
): SceneEnvironment | undefined {
	if (sky === null && treatment === undefined) return undefined;
	return {
		...(sky === null ? {} : { sky }),
		...(treatment === undefined ? {} : { treatment }),
	};
}

export function sceneWithEnvironment(
	scene: SceneData,
	sky: SceneSky | null,
	treatment: SceneTreatment | undefined,
): SceneData {
	const data: SceneData = { ...scene };
	delete (data as { environment?: unknown }).environment;
	const environment = buildEnvironment(sky, treatment);
	return environment === undefined ? data : { ...data, environment };
}

export function sameEnvironment(
	a: SceneEnvironment | undefined,
	b: SceneEnvironment | undefined,
): boolean {
	if (a === undefined || b === undefined) return a === b;
	if (a.treatment !== b.treatment) return false;
	if (a.sky === undefined || b.sky === undefined) return a.sky === b.sky;
	return sameSky(a.sky, b.sky);
}

export function unitSceneCandidate(
	request: PlannerRequest<ProjectEnvelope>,
	data: SceneData,
): ProjectEnvelope {
	const envelope = envelopeOf(request);
	return {
		...envelope,
		units: {
			...envelope.units,
			scene: { header: { ...envelope.units.scene.header }, data },
		},
	};
}
