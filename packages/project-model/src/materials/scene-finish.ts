/**
 * The compatibility seam from today's Scene 11 Finish record to the v1 grammar.
 *
 * PR A does not change the Scene codec. The current record carries a catalogue
 * base, a literal/follower colour, factors, five optional texture ids, a partial
 * metric mapping and the legacy normal scale/flip pair. This adapter states what
 * those fields mean in the portable grammar, so a baseline or a future Scene 12
 * reader can compare both spellings without guessing:
 *
 * - the base's tile is inherited unless the instance authors one;
 * - a normal flip is exactly the binding's `-Y` convention;
 * - a scalar texture id follows the established render slots: roughness G,
 *   occlusion R, metalness B;
 * - a normal scale only exists while a normal map is bound.
 */
import { catalogueRecipe } from './catalogue';
import type { MaterialIssue } from './issues';
import { readFinish } from './read';
import { NEUTRAL_RECIPE } from './recipe';
import type {
	Finish,
	FinishColor,
	FinishOverrides,
	LocalImage,
	Mapping,
	MapRole,
	Metric,
	OverrideMaps
} from './types';

/** The Scene 11 fields the adapter reads. */
export type SceneFinishSource = {
	readonly id: string;
	readonly name: string;
	readonly baseMaterialId: string;
	readonly color?: FinishColor;
	readonly roughness?: number;
	readonly metalness?: number;
	readonly maps?: Readonly<Partial<Record<MapRole, string>>>;
	readonly mapping?: {
		readonly tileMeters?: readonly [number, number];
		readonly rotation?: number;
		readonly offset?: readonly [number, number];
	};
	readonly normalScale?: number;
	readonly normalFlipY?: boolean;
};

export type SceneFinishAdaptation =
	| { readonly success: true; readonly finish: Finish }
	| { readonly success: false; readonly issues: readonly MaterialIssue[] };

function baseMetric(baseMaterialId: string): Metric {
	const recipe = catalogueRecipe(baseMaterialId);
	if (recipe !== undefined && recipe.mapping.kind !== 'uv') return recipe.mapping.metric;
	return NEUTRAL_RECIPE.mapping.kind === 'uv'
		? { tileMeters: [1, 1], rotation: 0, offset: [0, 0] }
		: NEUTRAL_RECIPE.mapping.metric;
}

function mappingOverride(
	source: SceneFinishSource['mapping'],
	baseMaterialId: string
): Mapping | undefined {
	if (source === undefined) return undefined;
	if (
		source.tileMeters === undefined &&
		source.rotation === undefined &&
		source.offset === undefined
	) {
		return undefined;
	}
	const base = baseMetric(baseMaterialId);
	return {
		kind: 'target',
		metric: {
			tileMeters:
				source.tileMeters === undefined
					? [base.tileMeters[0], base.tileMeters[1]]
					: [source.tileMeters[0], source.tileMeters[1]],
			rotation: source.rotation ?? base.rotation,
			offset:
				source.offset === undefined
					? [base.offset[0], base.offset[1]]
					: [source.offset[0], source.offset[1]]
		}
	};
}

const SCALAR_COMPONENT: Readonly<Record<'roughness' | 'occlusion' | 'metalness', 'r' | 'g' | 'b'>> = {
	roughness: 'g',
	occlusion: 'r',
	metalness: 'b'
};

/**
 * Adapt one Scene 11 Finish instance to the v1 wire shape. The adapter refuses
 * rather than repairs: an invalid name, colour or mapping is reported by the
 * same strict reader every other consumer uses.
 */
export function sceneFinishToContract(source: SceneFinishSource): SceneFinishAdaptation {
	const maps: Record<string, unknown> = {};
	const readImage = (role: MapRole): LocalImage | undefined => {
		const textureId = source.maps?.[role];
		return textureId === undefined ? undefined : { textureId };
	};
	const colorImage = readImage('color');
	if (colorImage !== undefined) maps.color = { image: colorImage };
	const normalImage = readImage('normal');
	const normalBound = normalImage !== undefined;
	if (normalImage !== undefined) {
		maps.normal = {
			image: normalImage,
			convention: source.normalFlipY === true ? '-Y' : '+Y'
		};
	}
	for (const role of ['roughness', 'occlusion', 'metalness'] as const) {
		const image = readImage(role);
		if (image === undefined) continue;
		maps[role] = {
			image,
			component: SCALAR_COMPONENT[role],
			invert: false
		};
	}

	const overrides: FinishOverrides = {
		...(source.color === undefined ? {} : { color: source.color }),
		...(source.roughness === undefined ? {} : { roughness: source.roughness }),
		...(source.metalness === undefined ? {} : { metalness: source.metalness }),
		...(normalBound && source.normalScale !== undefined
			? { normalScale: Math.abs(source.normalScale) }
			: {}),
		...(() => {
			const mapping = mappingOverride(source.mapping, source.baseMaterialId);
			return mapping === undefined ? {} : { mapping };
		})(),
		...(Object.keys(maps).length === 0 ? {} : { maps: maps as OverrideMaps })
	};

	const read = readFinish({
		id: source.id,
		name: source.name,
		base: { catalogue: source.baseMaterialId },
		...(Object.keys(overrides).length === 0 ? {} : { overrides })
	});
	return read.success ? { success: true, finish: read.finish } : { success: false, issues: read.issues };
}
