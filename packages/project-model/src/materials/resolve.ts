/**
 * One pure Finish resolver: base recipe + sparse overrides + palette + image
 * index → effective inputs with provenance.
 *
 * It is deliberately renderer-free. The editor's Scene look adapter, an API
 * package reader and a visitor delivery reader can therefore agree about every
 * authored signal without importing Three. Treatment is applied later, once, by
 * the render layer; these inputs are the untreated value inspection reports.
 */
import { SHIPPED_MATERIAL_IMAGES, catalogueRecipe, shippedImage } from './catalogue';
import { dedupeMaterialIssues } from './issues';
import { deepFreeze } from './immutable';
import { readOverrides, readRecipe } from './read';
import type {
	BoundInputs,
	Colour,
	ScalarComponent,
	FieldProvenance,
	FinishOverrides,
	FinishResolution,
	Hash,
	LocalImage,
	Mapping,
	MapRole,
	MaterialProfile,
	Normal,
	PaletteSlot,
	Recipe,
	ResolvedColour,
	ResolvedImage,
	ResolvedMaps,
	ResolvedNormal,
	ResolvedScalar,
	Scalar
} from './types';
import { MATERIAL_MAP_ROLES, MATERIAL_PROFILE } from './types';
import type { MaterialIssue } from './issues';

/** A base recipe source: a catalogue id or an already-normalized definition. */
export type ResolveBase = { readonly catalogue: string } | { readonly material: Recipe };

/**
 * The bridge from a recipe digest or an override's local image to a verified
 * image identity. A caller that cannot verify a source returns `null`; the
 * resolver then reports `missing-pin` rather than binding unverified bytes.
 */
export type ImageIndex = {
	/** Resolve a content digest to its local image identity, or `null`. */
	readonly byHash: (hash: Hash) => ResolvedImage | null;
	/** The verified digest of a local source, or `null` when it is not pinned. */
	readonly hashOf: (source: LocalImage) => Hash | null;
};

function sourceKey(source: LocalImage): string {
	return 'textureId' in source ? `texture:${source.textureId}` : `shipped:${source.shipped}`;
}

/**
 * An index over verified image identities.
 *
 * A digest may have several verified source aliases (two project texture IDs
 * holding identical bytes); every alias resolves back to the one canonical
 * digest while `byHash` keeps the first source as the canonical identity. A
 * source that is claimed for two different digests is a conflict: the first
 * verified claim wins and the later conflicting identity is not admitted, so
 * the index can never answer one source with two contents.
 */
export function createImageIndex(entries: readonly ResolvedImage[]): ImageIndex {
	const byHash = new Map<Hash, ResolvedImage>();
	const bySource = new Map<string, Hash>();
	for (const entry of entries) {
		const key = sourceKey(entry.source);
		const claimed = bySource.get(key);
		if (claimed !== undefined && claimed !== entry.hash) continue;
		if (!byHash.has(entry.hash)) byHash.set(entry.hash, entry);
		bySource.set(key, entry.hash);
	}
	return {
		byHash: (hash) => byHash.get(hash) ?? null,
		hashOf: (source) => bySource.get(sourceKey(source)) ?? null
	};
}

/** Merge indexes left-to-right; earlier indexes win on a conflict. */
export function mergeImageIndexes(...indexes: readonly ImageIndex[]): ImageIndex {
	return {
		byHash: (hash) => {
			for (const index of indexes) {
				const value = index.byHash(hash);
				if (value !== null) return value;
			}
			return null;
		},
		hashOf: (source) => {
			for (const index of indexes) {
				const value = index.hashOf(source);
				if (value !== null) return value;
			}
			return null;
		}
	};
}

/** The immutable shipped catalogue's images, keyed by hash and allowlisted URI. */
export function shippedImageIndex(): ImageIndex {
	const entries: ResolvedImage[] = SHIPPED_MATERIAL_IMAGES.map((image) => ({
		hash: image.hash,
		source: { shipped: image.uri }
	}));
	const index = createImageIndex(entries);
	return {
		byHash: (hash) => index.byHash(hash),
		hashOf: (source) => {
			if (!('shipped' in source)) return null;
			const image = shippedImage(source.shipped);
			return image === undefined ? null : image.hash;
		}
	};
}

/** A resource-backed definition's images as an index. */
export function materialImageIndex(
	images: readonly { readonly hash: Hash; readonly source: LocalImage }[]
): ImageIndex {
	return createImageIndex(images.map((image) => ({ hash: image.hash, source: image.source })));
}

function prefixIssues(issues: readonly MaterialIssue[], prefix: string): MaterialIssue[] {
	return issues.map((issue) => ({
		...issue,
		path: issue.path === '$' ? prefix : `${prefix}${issue.path.slice(1)}`
	}));
}

function paletteColor(
	slotId: string,
	palette: readonly PaletteSlot[] | undefined
): { readonly color: string | null; readonly found: boolean } {
	const slot = palette?.find((entry) => entry.id === slotId);
	if (slot === undefined) return { color: null, found: false };
	if (!/^#[0-9a-f]{6}$/i.test(slot.color)) return { color: null, found: true };
	return { color: slot.color.toLowerCase(), found: true };
}

function resolveBaseBinding(
	role: MapRole,
	binding: Colour<Hash> | Normal<Hash> | Scalar<Hash>,
	setMapping: Mapping,
	imageIndex: ImageIndex,
	issues: MaterialIssue[]
): ResolvedColour & {
	readonly convention?: '+Y' | '-Y';
	readonly component?: ScalarComponent;
	readonly invert?: boolean;
} {
	const mapping = binding.mapping ?? setMapping;
	const image = imageIndex.byHash(binding.image);
	if (image === null) {
		issues.push({
			code: 'missing-pin',
			path: `$.maps.${role}.image`,
			role,
			action: 'Pin the image or remove the binding.'
		});
	}
	const resolved: ResolvedColour & {
		convention?: '+Y' | '-Y';
		component?: ScalarComponent;
		invert?: boolean;
	} = { image, mapping };
	if (role === 'normal') resolved.convention = (binding as Normal<Hash>).convention;
	if (role !== 'color' && role !== 'normal') {
		const scalar = binding as Scalar<Hash>;
		resolved.component = scalar.component;
		resolved.invert = scalar.invert;
	}
	return resolved;
}

function resolveOverrideBinding(
	role: MapRole,
	binding: Colour<LocalImage> | Normal<LocalImage> | Scalar<LocalImage>,
	setMapping: Mapping,
	imageIndex: ImageIndex,
	issues: MaterialIssue[]
): ResolvedColour & {
	readonly convention?: '+Y' | '-Y';
	readonly component?: ScalarComponent;
	readonly invert?: boolean;
} {
	const mapping = binding.mapping ?? setMapping;
	const hash = imageIndex.hashOf(binding.image);
	let image: ResolvedImage | null = null;
	if (hash === null) {
		issues.push({
			code: 'missing-pin',
			path: `$.overrides.maps.${role}.image`,
			role,
			action: 'Import or pin the image before binding it.'
		});
	} else {
		image = imageIndex.byHash(hash) ?? { hash, source: binding.image };
	}
	const resolved: ResolvedColour & {
		convention?: '+Y' | '-Y';
		component?: ScalarComponent;
		invert?: boolean;
	} = { image, mapping };
	if (role === 'normal') resolved.convention = (binding as Normal<LocalImage>).convention;
	if (role !== 'color' && role !== 'normal') {
		const scalar = binding as Scalar<LocalImage>;
		resolved.component = scalar.component;
		resolved.invert = scalar.invert;
	}
	return resolved;
}

function provenance(source: 'base' | 'override' | 'disabled'): FieldProvenance {
	return { source };
}

/**
 * Resolve one Finish's effective, untreated inputs.
 *
 * The result is frozen. `issues` are canonical-ordered; a `null` input image is
 * retained on its binding so inspection can still name the authored role.
 */
export function resolveFinish(
	base: ResolveBase,
	overrides: FinishOverrides | undefined,
	palette: readonly PaletteSlot[] | undefined,
	imageIndex: ImageIndex
): FinishResolution {
	const issues: MaterialIssue[] = [];
	let baseRecipe: Recipe | null = null;
	if ('catalogue' in base) {
		baseRecipe = catalogueRecipe(base.catalogue) ?? null;
		if (baseRecipe === null) {
			issues.push({
				code: 'unknown-catalogue-base',
				path: '$.base.catalogue',
				action: 'Use an admitted catalogue base.'
			});
		}
	} else {
		const read = readRecipe(base.material);
		if (read.success) baseRecipe = read.recipe;
		else issues.push(...prefixIssues(read.issues, '$.base.material'));
	}

	let normalizedOverrides: FinishOverrides | undefined;
	if (overrides !== undefined) {
		const read = readOverrides(overrides);
		if (read.success) normalizedOverrides = read.overrides;
		else issues.push(...prefixIssues(read.issues, '$.overrides'));
	}
	if (baseRecipe === null) {
		return { inputs: null, issues: dedupeMaterialIssues(issues) };
	}

	const setMapping = normalizedOverrides?.mapping ?? baseRecipe.mapping;
	const provenanceMaps = {} as Record<MapRole, FieldProvenance>;
	const maps: {
		color?: ResolvedColour;
		normal?: ResolvedNormal;
		roughness?: ResolvedScalar;
		metalness?: ResolvedScalar;
		occlusion?: ResolvedScalar;
	} = {};

	for (const role of MATERIAL_MAP_ROLES) {
		const override = normalizedOverrides?.maps?.[role];
		if (override === null) {
			provenanceMaps[role] = provenance('disabled');
			continue;
		}
		if (override !== undefined) {
			provenanceMaps[role] = provenance('override');
			const resolved = resolveOverrideBinding(role, override as never, setMapping, imageIndex, issues);
			maps[role] = resolved as never;
			continue;
		}
		const baseBinding = baseRecipe.maps[role];
		if (baseBinding === undefined) {
			provenanceMaps[role] = provenance('base');
			continue;
		}
		provenanceMaps[role] = provenance('base');
		const resolved = resolveBaseBinding(role, baseBinding as never, setMapping, imageIndex, issues);
		maps[role] = resolved as never;
	}

	let color = baseRecipe.color;
	let colorProvenance: FieldProvenance = provenance('base');
	const overrideColor = normalizedOverrides?.color;
	if (overrideColor !== undefined) {
		if (typeof overrideColor === 'string') {
			color = overrideColor.toLowerCase();
			colorProvenance = provenance('override');
		} else {
			const paletteValue = paletteColor(overrideColor.slot, palette);
			if (!paletteValue.found) {
				issues.push({
					code: 'missing-palette-slot',
					path: '$.overrides.color',
					action: 'Restore the palette slot or set a literal colour.'
				});
			} else if (paletteValue.color === null) {
				issues.push({
					code: 'invalid-colour',
					path: '$.overrides.color',
					action: 'Use a lowercase #rrggbb palette colour.'
				});
			} else {
				color = paletteValue.color;
			}
			colorProvenance = { source: 'override', paletteSlot: overrideColor.slot };
		}
	}

	const inputs: BoundInputs = {
		profile: MATERIAL_PROFILE as MaterialProfile,
		color,
		roughness: normalizedOverrides?.roughness ?? baseRecipe.roughness,
		metalness: normalizedOverrides?.metalness ?? baseRecipe.metalness,
		occlusionStrength:
			normalizedOverrides?.occlusionStrength ?? baseRecipe.occlusionStrength,
		normalScale: normalizedOverrides?.normalScale ?? baseRecipe.normalScale,
		mapping: setMapping,
		maps: maps as ResolvedMaps,
		provenance: {
			color: colorProvenance,
			roughness:
				normalizedOverrides?.roughness === undefined ? provenance('base') : provenance('override'),
			metalness:
				normalizedOverrides?.metalness === undefined ? provenance('base') : provenance('override'),
			occlusionStrength:
				normalizedOverrides?.occlusionStrength === undefined
					? provenance('base')
					: provenance('override'),
			normalScale:
				normalizedOverrides?.normalScale === undefined ? provenance('base') : provenance('override'),
			mapping:
				normalizedOverrides?.mapping === undefined ? provenance('base') : provenance('override'),
			maps: provenanceMaps
		}
	};
	return { inputs: deepFreeze(inputs), issues: dedupeMaterialIssues(issues) };
}
