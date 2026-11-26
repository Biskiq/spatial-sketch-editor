/**
 * The portable sampling plan for one bound Finish.
 *
 * `bindFinish` answers which target UV set and affine transform sample each bound
 * image. This module freezes that answer into the plain, canonical shape the
 * renderer consumes: role, image identity, UV set, origin convention, transform
 * and scalar conversion. It is still renderer-free; an editor view key and a
 * Three `Texture` are supplied by the render layer.
 *
 * Two rules are load-bearing:
 *
 * - **Origin is a signal of the mapping, not a second flag.** A `target` or
 *  `surface` mapping samples the repository's established TextureLoader rows
 *  (`1−v`); an explicit glTF `uv` mapping samples the authored rows (`v`).
 *  Mixing the two is what an asymmetric checker catches.
 * - **One plan is one canonical key.** Sorting by role and encoding every field
 *  makes the key a function of meaning, so two equal plans share one material
 *  and a changed component or convention cannot reuse one.
 */
import type { Hash, LocalImage, MapRole, SamplingEntry } from './types';

/** The plan version; a changed sampling meaning is a new version, not a field. */
export const FINISH_SAMPLING_PLAN_VERSION = 1 as const;

/**
 * Where the image's rows start.
 *
 * - `legacy`: the repository's established TextureLoader upload convention, so
 *  the sample boundary reads row `1−v`.
 * - `gltf`: an explicit glTF UV binding, whose origin is the upper-left, so the
 *  sample boundary reads row `v`.
 */
export type FinishPlanOrigin = 'legacy' | 'gltf';

/** One image role as the renderer will sample it. */
export type FinishSamplingPlanEntry = {
	readonly role: MapRole;
	/** The content identity of the image, when the resolver knows one. */
	readonly hash: Hash;
	readonly source: LocalImage;
	readonly uvSet: 0 | 1;
	readonly origin: FinishPlanOrigin;
	/** Native-UV multiplier, not a surface tile count. */
	readonly repeat: readonly [number, number];
	readonly rotation: number;
	readonly offset: readonly [number, number];
	readonly convention?: '+Y' | '-Y';
	readonly component?: 'r' | 'g' | 'b' | 'a';
	readonly invert?: boolean;
};

/**
 * A plan carries only map sampling. The colour factor, roughness, metalness and
 * normal strength stay on the descriptor; the plan never duplicates them, so a
 * scalar edit cannot disagree with the sampling graph.
 */
export type FinishSamplingPlan = {
	readonly profile: 'pbr-metallic-roughness/v1';
	readonly version: typeof FINISH_SAMPLING_PLAN_VERSION;
	readonly entries: readonly FinishSamplingPlanEntry[];
};

/** The role order every plan and key uses. */
const ROLE_ORDER: readonly MapRole[] = ['color', 'normal', 'roughness', 'metalness', 'occlusion'];

function numberText(value: number): string {
	if (!Number.isFinite(value)) throw new Error(`finish plan value ${value} is not finite`);
	return String(value === 0 ? 0 : value);
}

function pairText(pair: readonly [number, number]): string {
	return `${numberText(pair[0])},${numberText(pair[1])}`;
}

/** The canonical key of one plan: role order, every field, no separators leaked. */
export function finishSamplingPlanKey(plan: FinishSamplingPlan): string {
	return [
		`${plan.profile}@${plan.version}`,
		...[...plan.entries]
			.sort((left, right) => ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role))
			.map((entry) =>
				[
					entry.role,
					'textureId' in entry.source
						? `texture:${encodeURIComponent(entry.source.textureId)}`
						: `shipped:${encodeURIComponent(entry.source.shipped)}`,
					entry.hash,
					entry.uvSet,
					entry.origin,
					pairText(entry.repeat),
					numberText(entry.rotation),
					pairText(entry.offset),
					entry.convention ?? '-',
					entry.component ?? '-',
					entry.invert === true ? '1' : '0',
				].join(':'),
			),
	].join('|');
}

/** The plan for one bound Finish, in canonical role order. */
export function finishSamplingPlan(bound: {
	readonly samples: readonly SamplingEntry[];
}): FinishSamplingPlan {
	const entries = [...bound.samples]
		.sort((left, right) => ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role))
		.map(
			(sample): FinishSamplingPlanEntry => ({
				role: sample.role,
				hash: sample.image.hash,
				source: sample.image.source,
				uvSet: sample.uvSet,
				origin: sample.origin,
				repeat: [sample.repeat[0], sample.repeat[1]],
				rotation: sample.rotation,
				offset: [sample.offset[0], sample.offset[1]],
				...(sample.convention === undefined ? {} : { convention: sample.convention }),
				...(sample.component === undefined ? {} : { component: sample.component }),
				...(sample.invert === undefined ? {} : { invert: sample.invert }),
			}),
		);
	return Object.freeze({
		profile: 'pbr-metallic-roughness/v1',
		version: FINISH_SAMPLING_PLAN_VERSION,
		entries: Object.freeze(entries),
	});
}

/**
 * The exact uncompressed RGBA8 bytes of one texture's mip chain, summing the
 * levels the renderer actually allocates down to 1×1.
 */
export function rgba8MipChainBytes(width: number, height: number): number {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return 0;
	let total = 0;
	let w = Math.floor(width);
	let h = Math.floor(height);
	while (true) {
		total += w * h * 4;
		if (w === 1 && h === 1) break;
		w = Math.max(1, Math.floor(w / 2));
		h = Math.max(1, Math.floor(h / 2));
	}
	return total;
}
