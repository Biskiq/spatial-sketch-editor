/**
 * Shared inputs for the material-contract suites.
 *
 * These are deliberately narrow, visible fixtures: a recipe is either the
 * neutral default, one catalogue base, or a small explicit object whose every
 * number is readable at the call site. No opaque universal builder.
 */
import {
	createImageIndex,
	type Hash,
	type ImageIndex,
	type LocalImage,
	type Recipe,
	type TargetFacts
} from '@portfolio/project-model/materials';

/** A shape-valid sha256 identity; the suites do not need a real digest. */
export function contentHash(label: string): Hash {
	let hex = '';
	for (let index = 0; index < 64; index += 1) {
		hex += (label.charCodeAt(index % label.length) % 16).toString(16);
	}
	return `sha256-${hex}`;
}

export const IMAGE_HASH = {
	color: contentHash('color'),
	normal: contentHash('normal'),
	orm: contentHash('orm'),
	roughness: contentHash('roughness'),
	alternate: contentHash('alternate')
} as const;

export const IMAGE_SOURCE: Readonly<Record<keyof typeof IMAGE_HASH, LocalImage>> = {
	color: { textureId: 'texture-color' },
	normal: { textureId: 'texture-normal' },
	orm: { textureId: 'texture-orm' },
	roughness: { textureId: 'texture-roughness' },
	alternate: { shipped: '/textures/fixture/alternate.png' }
};

export function fixtureImageIndex(): ImageIndex {
	return createImageIndex([
		{ hash: IMAGE_HASH.color, source: IMAGE_SOURCE.color },
		{ hash: IMAGE_HASH.normal, source: IMAGE_SOURCE.normal },
		{ hash: IMAGE_HASH.orm, source: IMAGE_SOURCE.orm },
		{ hash: IMAGE_HASH.roughness, source: IMAGE_SOURCE.roughness }
	]);
}

/** A recipe with one of every role, for binding and provenance cases. */
export function fullRecipe(): Recipe {
	return {
		profile: 'pbr-metallic-roughness/v1',
		color: '#c4b4a0',
		roughness: 0.62,
		metalness: 0.18,
		occlusionStrength: 0.75,
		normalScale: 1.4,
		mapping: {
			kind: 'target',
			metric: { tileMeters: [0.8, 1.6], rotation: 0.4, offset: [0.25, 0.5] }
		},
		maps: {
			color: { image: IMAGE_HASH.color },
			normal: { image: IMAGE_HASH.normal, convention: '+Y' },
			roughness: { image: IMAGE_HASH.orm, component: 'g', invert: false },
			metalness: { image: IMAGE_HASH.orm, component: 'b', invert: false },
			occlusion: { image: IMAGE_HASH.orm, component: 'r', invert: false }
		}
	};
}

/** A native Form: metre UVs and a 3.2 × 1.6 m surface. */
export const FORM_FACTS: TargetFacts = {
	subject: 'form:1',
	geometryRevision: 'geometry-form-1',
	metricBasis: { uvMeters: [1, 1], surfaceMeters: [3.2, 1.6] },
	draws: [{ drawKey: 'primitive-0', uvSets: [0], normalFrameSets: [0] }]
};

/** A legacy GLB remap: no metric basis, UV0 only. */
export const MODEL_FACTS: TargetFacts = {
	subject: 'model:1',
	geometryRevision: 'asset-revision-7',
	draws: [{ drawKey: 'mesh-0', uvSets: [0], normalFrameSets: [0] }]
};

/** A two-UV static mesh: mirrored UV1, valid tangent frames on both sets. */
export const TWO_UV_FACTS: TargetFacts = {
	subject: 'model:two-uv',
	geometryRevision: 'asset-revision-9',
	draws: [{ drawKey: 'mesh-0', uvSets: [0, 1], normalFrameSets: [0, 1] }]
};
