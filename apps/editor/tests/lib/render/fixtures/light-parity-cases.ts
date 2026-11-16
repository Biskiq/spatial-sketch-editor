/**
 * E10/R6 — the fixed light parity cases.
 *
 * Each case mounts one world (authored lights through `VisitorEntityGroups`
 * and the Sky through `WorldEnvironment`, exactly as the Stage and Preview
 * Canvases do) and then applies its patches in order. The baseline file records
 * the full light snapshot after the mount and after every patch, read from the
 * pre-E10 components; the parity test replays the same steps through the
 * resolved-light store and must read the identical snapshot at every step.
 */
import type { RuntimeScene, SceneLightEntity } from '@portfolio/project-model';
import { skyFromPreset } from '@portfolio/project-model/units';

type PointEntity = Extract<SceneLightEntity, { light: 'point' }>;
type SpotEntity = Extract<SceneLightEntity, { light: 'spot' }>;
import type { LightWorldProps } from './LightWorldHarness.svelte';

export const POINT_RANGED: PointEntity = {
	kind: 'light',
	id: 'point-ranged',
	name: 'Point ranged',
	light: 'point',
	position: [1.5, 2.4, -0.75],
	rotation: [0, 0, 0],
	color: '#ffd6a5',
	intensity: Math.PI,
	range: 6,
	castShadow: true
};

export const POINT_OPEN: PointEntity = {
	kind: 'light',
	id: 'point-open',
	name: 'Point open',
	light: 'point',
	position: [-2, 1.8, 3],
	rotation: [0.1, 0.2, 0.3],
	scale: 2,
	color: '#ffffff',
	intensity: 0.25 * Math.PI,
	castShadow: false
};

export const SPOT_AIMED: SpotEntity = {
	kind: 'light',
	id: 'spot-aimed',
	name: 'Spot aimed',
	light: 'spot',
	position: [0.5, 3, 1],
	rotation: [-1.1, 0.4, 0.05],
	color: '#dbe9ff',
	intensity: 4 * Math.PI,
	range: 9.5,
	angle: 0.42,
	penumbra: 0.3,
	castShadow: true
};

export const SPOT_PLAIN: SpotEntity = {
	kind: 'light',
	id: 'spot-plain',
	name: 'Spot plain',
	light: 'spot',
	position: [-1, 2.2, -2],
	rotation: [-Math.PI / 2, 0, 0],
	scale: 0.5,
	color: '#ffffff',
	intensity: 2 * Math.PI,
	angle: Math.PI / 5,
	castShadow: false
};

export function runtimeScene(entities: readonly SceneLightEntity[]): RuntimeScene {
	return { textures: [], materials: [], entities: [...entities], objects: [] } as unknown as RuntimeScene;
}

const STAGE_BOUNDS = { min: [-6, 0, -4], max: [8, 3, 5] } as const;
const STAGE_SHADOW_BOUNDS = { min: [-5.5, 0, -3.5], max: [7.5, 3.4, 4.5] } as const;
const VISITOR_BOUNDS = { min: [-10, 0, -6], max: [4, 2.8, 9] } as const;

export type LightParityCase = {
	readonly name: string;
	readonly initial: LightWorldProps;
	readonly steps: readonly { readonly name: string; readonly patch: Partial<LightWorldProps> }[];
};

const ALL = [POINT_RANGED, POINT_OPEN, SPOT_AIMED, SPOT_PLAIN];

export const LIGHT_PARITY_CASES: readonly LightParityCase[] = [
	{
		// The Stage: flat ground, shadow bounds and a raised datum.
		name: 'stage daylight',
		initial: {
			scene: runtimeScene(ALL),
			sky: skyFromPreset('daylight', 0),
			bounds: STAGE_BOUNDS,
			shadowBounds: STAGE_SHADOW_BOUNDS,
			groundY: 0.3,
			flatGround: true,
			includeLights: true
		},
		steps: [
			{
				name: 'spot properties changed',
				patch: {
					scene: runtimeScene([
						POINT_RANGED,
						POINT_OPEN,
						{ ...SPOT_AIMED, color: '#ffd6a5', intensity: 0.5 * Math.PI, range: 4, angle: 0.9, penumbra: 0.8, castShadow: false, rotation: [-0.6, -0.2, 0], position: [1, 2.5, 0] },
						SPOT_PLAIN
					])
				}
			},
			{
				name: 'point range removed and shadow on',
				patch: {
					scene: runtimeScene([
						{ ...POINT_RANGED, range: undefined, castShadow: false },
						{ ...POINT_OPEN, castShadow: true, scale: 1 },
						SPOT_AIMED,
						SPOT_PLAIN
					])
				}
			},
			{ name: 'shadow bounds moved', patch: { shadowBounds: { min: [-2, 0, -2], max: [3, 6, 2] }, groundY: 0 } },
			{ name: 'preset changed', patch: { sky: skyFromPreset('golden-hour', 0) } },
			{
				name: 'kind replaced',
				patch: {
					scene: runtimeScene([
						{ ...SPOT_AIMED, id: 'point-ranged', name: 'Was point' },
						POINT_OPEN
					])
				}
			},
			{ name: 'lights removed', patch: { scene: runtimeScene([]) } },
			{ name: 'environment to paper', patch: { sky: null } },
			{ name: 'environment back', patch: { sky: skyFromPreset('dusk', 0), scene: runtimeScene(ALL) } }
		]
	},
	{
		// The Preview / published visit: lit ground, World bounds only.
		name: 'visitor golden hour',
		initial: {
			scene: runtimeScene(ALL),
			sky: skyFromPreset('golden-hour', 0),
			bounds: VISITOR_BOUNDS,
			shadowBounds: null,
			groundY: 0,
			flatGround: false,
			includeLights: true
		},
		steps: [
			{ name: 'bounds grew', patch: { bounds: { min: [-20, 0, -12], max: [14, 4, 18] } } },
			{ name: 'bounds cleared', patch: { bounds: null } },
			{ name: 'dusk', patch: { sky: skyFromPreset('dusk', 0) } }
		]
	},
	{
		// A Paper reading never draws authored lights and has no Sky.
		name: 'paper',
		initial: {
			scene: runtimeScene(ALL),
			sky: null,
			bounds: STAGE_BOUNDS,
			shadowBounds: null,
			groundY: 0,
			flatGround: true,
			includeLights: false
		},
		steps: [{ name: 'lights shown', patch: { includeLights: true } }]
	}
];
