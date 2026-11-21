/**
 * The look-parity case table shared by the step-0 golden and the material suite.
 *
 * The golden records **outputs** only. Every input is built here, so the Scene 8
 * schema change re-expresses the same look (`baseTextureId` becomes `maps.color`)
 * without touching a single golden byte: the parity proof is that the recorded
 * descriptors still match.
 */
import type { MaterialId } from '@portfolio/project-model';
import type { SceneDocument } from '$lib/content/scene';
import type { LookSource } from '$lib/render/materials/scene-finish';
import {
	skyFromPreset,
	type SceneEnvironmentChoice
} from '@portfolio/project-model/units';
import type { WorldEnvironmentFrame, WorldEnvironmentLook } from '$lib/render/world-environment';
import { worldEnvironmentLook } from '$lib/render/world-environment';

/** The one project texture every `instance-map` case binds. */
export const LOOK_TEXTURE = {
	id: 'wall-detail',
	name: 'Wall Detail',
	uri: '/textures/wall-detail.webp',
	hash: `sha256-${'6'.repeat(64)}`
} as const;

export type LookCase = {
	readonly id: string;
	readonly fallbackCatalogueId: MaterialId;
	/** `null` is the catalogue-only look; otherwise one instance override. */
	readonly instance: {
		readonly roughness?: number;
		readonly metalness?: number;
		/** The project texture bound to the colour slot. */
		readonly mapTextureId?: string;
	} | null;
	readonly surface: readonly [number, number];
};

const CATALOGUE_IDS: readonly MaterialId[] = [
	'plaster-warm',
	'wood-walnut',
	'brass-aged',
	'marble-light',
	'velvet-dark',
	'paper-aged'
];

/**
 * Every catalogue look with no instance, every id with a roughness/metalness
 * instance, and every id with a colour-map instance. The surface sizes are the
 * catalogue tile sizes and a non-square size, so `computeTextureRepeat` is
 * exercised on both.
 */
export const LOOK_CASES: readonly LookCase[] = [
	...CATALOGUE_IDS.map(
		(id, index): LookCase => ({
			id: `catalogue:${id}`,
			fallbackCatalogueId: id,
			instance: null,
			surface: index % 2 === 0 ? [2, 2] : [3.5, 1.25]
		})
	),
	...CATALOGUE_IDS.map(
		(id, index): LookCase => ({
			id: `instance-scalars:${id}`,
			fallbackCatalogueId: id,
			instance: { roughness: 0.35, metalness: index === 2 ? 0.6 : 0 },
			surface: index % 2 === 0 ? [1.5, 1.5] : [2.25, 4]
		})
	),
	...CATALOGUE_IDS.map(
		(id, index): LookCase => ({
			id: `instance-map:${id}`,
			fallbackCatalogueId: id,
			instance: { mapTextureId: LOOK_TEXTURE.id },
			surface: index % 2 === 0 ? [2, 2] : [0.75, 3]
		})
	)
];

/** The material-instance id one case writes; unique within the case's document. */
export function lookCaseInstanceId(lookCase: LookCase): string {
	return `instance:${lookCase.id}`;
}

/**
 * The Scene input for one case. The Scene 7 golden's colour map is expressed
 * as Scene 8's `maps.color`; the expected output is unchanged.
 */
export function lookCaseDocument(lookCase: LookCase): LookSource {
	const instance = lookCase.instance;
	const overrides = instance === null
		? undefined
		: {
				...(instance.mapTextureId === undefined
					? {}
					: { maps: { color: { image: { textureId: instance.mapTextureId } } } }),
				...(instance.roughness === undefined ? {} : { roughness: instance.roughness }),
				...(instance.metalness === undefined ? {} : { metalness: instance.metalness })
			};
	return {
		textures: [{ ...LOOK_TEXTURE }],
		materialIndex: {
			definitions: new Map(),
			definitionImages: new Map(),
			images: [{ hash: LOOK_TEXTURE.hash, source: { textureId: LOOK_TEXTURE.id } }]
		},
		materials:
			instance === null
				? []
				: [
						{
							id: lookCaseInstanceId(lookCase),
							name: lookCase.id,
							base: { catalogue: lookCase.fallbackCatalogueId },
							...(overrides === undefined ? {} : { overrides })
						}
					]
	};
}

/** The frame every Sun case resolves against. */
export type SunCase = {
	readonly id: string;
	readonly preset: SceneEnvironmentChoice;
	readonly frame: WorldEnvironmentFrame;
};

const BOUNDS = { min: [-5, 0, -3], max: [5, 3, 4] } as const;
const SHADOW_BOUNDS = { min: [-4, 0, -2.5], max: [4, 2.5, 3.5] } as const;

/** The three presets plus Paper, on the visit frame and the editor Stage frame. */
export const SUN_CASES: readonly SunCase[] = (
	['studio', 'daylight', 'golden-hour', 'dusk', 'overcast', 'moonlit'] as const
).flatMap((preset): SunCase[] => [
	{
		id: `visit:${preset}`,
		preset,
		frame: { bounds: BOUNDS, shadowBounds: null, groundY: 0, flatGround: false }
	},
	{
		id: `stage:${preset}`,
		preset,
		frame: { bounds: BOUNDS, shadowBounds: SHADOW_BOUNDS, groundY: -0.02, flatGround: true }
	}
]);

/**
 * The resolved look one Sun case renders, or `null` for Paper. Scene 8 reads a
 * stored Sky, so the case supplies the named preset's start — the exact Sky the
 * editor's environment writer copies into a World.
 */
export function sunCaseLook(preset: SceneEnvironmentChoice): WorldEnvironmentLook | null {
	return worldEnvironmentLook(skyFromPreset(preset, 0));
}
