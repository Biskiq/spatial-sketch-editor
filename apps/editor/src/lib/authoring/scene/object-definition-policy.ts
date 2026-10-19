/**
 * T2.P01.S01 — the host policy adapter for normalized object definitions.
 *
 * `@portfolio/project-model` plans placements and must not import this app's
 * catalogue or Three, so this module is the single place where the catalogue is
 * read and turned into the pure `NormalizedPlacementDefinition` the planner
 * consumes. It is editor-side by construction: nothing under `packages/` can
 * import it.
 *
 * Two rules this module exists to enforce:
 *
 * - **Declared metadata, never measured geometry.** Footprints come from the
 *   catalogue's canonical meters and contacts from declared analytical values or
 *   a recorded verification. An asynchronously loaded mesh bound is never an
 *   unrecorded placement input, so nothing here reads a live bounding box.
 * - **Renderer normalization stays the renderer's.** The catalogue's
 *   `defaultScale`/`defaultRotation` are carried as
 *   `renderNormalization` — the identity of the correction the renderer applies
 *   *inside* its own root — and are never copied into an authored instance
 *   transform. A piano with `defaultScale: 0.032` placed at instance scale 1 has
 *   canonical 1.48 x 1.59 m footprint and contact 0; the authored entity carries
 *   neither number.
 *
 * The inventory below is the slice's reviewable admission artifact: every
 * catalogue asset whose declared surface is `floor` appears exactly once, either
 * admitted or excluded with reasons a reviewer can check.
 */
import {
	definitionMetadataContentId,
	type NormalizedPlacementDefinition,
	type ObjectCreationDefaults,
	type ObjectDefinitionAdmission,
	type ObjectDefinitionExclusion
} from '@portfolio/project-model';
import {
	assets,
	normalizeAssetFootprintOutline,
	resolveAssetFallback,
	validateAssetFootprint
} from '$lib/content/assets';
import type { Asset } from '$lib/types/assets';
import type { LayoutVec2 } from '@portfolio/layout-core';

/** The native primitives admitted for upright floor placement. */
export const NATIVE_PLACEMENT_PRIMITIVES = ['box', 'cylinder', 'sphere'] as const;
export type NativePlacementPrimitive = (typeof NATIVE_PLACEMENT_PRIMITIVES)[number];

/** Declared native dimensions in canonical meters (a 1 m cube, a 1 m column, a 1 m ball). */
export const NATIVE_PLACEMENT_DIMENSIONS = {
	box: { width: 1, height: 1, depth: 1 },
	cylinder: { radius: 0.5, height: 1 },
	sphere: { radius: 0.5 }
} as const;

/** The circle resolution the retained Plan footprint projection already uses. */
const CIRCLE_STEPS = 32;

const PLANE_EXCLUSION: ObjectDefinitionExclusion = {
	code: 'plane-primitive',
	reason:
		'A vertical plane has no honest horizontal footprint, so it is not admitted for upright floor placement.'
};

/**
 * A floor contact established for one catalogue model.
 *
 * `contactSource` says how it was established. `verified` is true only when an
 * r186 loader verification recorded the corrected contact and footprint on the
 * landed base; only verified records admit a model.
 */
export type CatalogueModelContactRecord = {
	assetId: string;
	/** Declared floor contact in normalized placement-local meters. */
	contactMinY: number;
	contactSource: 'catalogue-floor-pivot-note' | 'r186-loader-verification';
	verified: boolean;
	/** The verification this record cites; present exactly when `verified`. */
	verificationId?: string;
	/** Reproducible corrected-geometry failure; never permission to admit. */
	verificationFailure?: {
		verificationId: string;
		contactMinY: number;
		footprintWidth: number;
		footprintDepth: number;
	};
	/** True when the source model needs a non-unit scale correction to reach canonical meters. */
	nonUnitSourceNormalization: boolean;
	notes: string;
};

/**
 * Declared contacts for the catalogue's floor models.
 *
 * The floor-pivoted production models declare their contact as 0 m. That is a
 * *declaration*, not a verification: the retained-loader contact verification on
 * the landed r186 base (three 0.186.1, `PCFShadowMap`) is the outstanding
 * obligation recorded with this slice. The piano geometry check failed and is
 * recorded below; the other models await verification. Every model remains
 * excluded until corrected geometry, footprint/contact and readiness are verified. Analytical primitives need no such verification.
 */
export const CATALOGUE_MODEL_CONTACT_RECORDS: readonly CatalogueModelContactRecord[] = [
	{
		assetId: 'paris-grand-piano',
		contactMinY: 0,
		contactSource: 'catalogue-floor-pivot-note',
		verified: false,
		nonUnitSourceNormalization: true,
		verificationFailure: {
			verificationId: 's01-r186-piano-geometry-v1',
			contactMinY: 0.0000507284917601325,
			footprintWidth: 1.4825150338836297,
			footprintDepth: 2.524
		},
		notes:
			'Non-unit source normalization is the discriminating case: the asset declares defaultScale 0.032 and a floor-centred pivot, and its canonical footprint is the authored 1.48 x 1.59 m outline. The r186 geometry verification failed: corrected X/Z extent is 1.482515 x 2.524 m, exceeding the declared 1.48 x 1.59 m footprint; min Y is 0.0000507285 m rather than the declared zero. The source/metadata needs a separately reviewed correction before admission.'
	},
	{
		assetId: 'paris-salon-chair',
		contactMinY: 0,
		contactSource: 'catalogue-floor-pivot-note',
		verified: false,
		nonUnitSourceNormalization: true,
		notes: 'Floor-centred pivot, defaultScale 0.92; corrected contact awaits the r186 loader verification.'
	},
	{
		assetId: 'paris-salon-sofa',
		contactMinY: 0,
		contactSource: 'catalogue-floor-pivot-note',
		verified: false,
		nonUnitSourceNormalization: true,
		notes: 'Floor-centred pivot, defaultScale 0.9; corrected contact awaits the r186 loader verification.'
	},
	{
		assetId: 'paris-salon-table',
		contactMinY: 0,
		contactSource: 'catalogue-floor-pivot-note',
		verified: false,
		nonUnitSourceNormalization: true,
		notes: 'Floor-centred pivot, defaultScale 0.21; corrected contact awaits the r186 loader verification.'
	},
	{
		assetId: 'paris-grandfather-clock',
		contactMinY: 0,
		contactSource: 'catalogue-floor-pivot-note',
		verified: false,
		nonUnitSourceNormalization: true,
		notes: 'Floor-centred pivot, defaultScale 0.008; corrected contact awaits the r186 loader verification.'
	}
];

export type PlacementDefinitionInventoryEntry = {
	definitionKey: string;
	source:
	| { kind: 'native'; primitive: NativePlacementPrimitive }
	| { kind: 'catalogue-model'; assetId: string };
	admission: 'admitted' | 'excluded';
	exclusions: readonly ObjectDefinitionExclusion[];
	footprintSource: 'analytical-primitive' | 'catalogue-footprint' | 'none';
	contactSource: 'analytical' | CatalogueModelContactRecord['contactSource'] | 'none';
	nonUnitSourceNormalization: boolean;
};

/** Every floor-surface definition, admitted or excluded with its reasons. */
export function objectDefinitionInventory(
	manifest: readonly Asset[] = assets
): readonly PlacementDefinitionInventoryEntry[] {
	const entries: PlacementDefinitionInventoryEntry[] = NATIVE_PLACEMENT_PRIMITIVES.map((primitive) => ({
		definitionKey: nativeDefinitionKey(primitive),
		source: { kind: 'native', primitive },
		admission: 'admitted',
		exclusions: [],
		footprintSource: 'analytical-primitive',
		contactSource: 'analytical',
		nonUnitSourceNormalization: false
	}));
	for (const asset of manifest) {
		if (asset.placementSurface !== 'floor') continue;
		const exclusions = catalogueModelExclusions(asset);
		const record = contactRecordFor(asset.id);
		entries.push({
			definitionKey: modelDefinitionKey(asset.id),
			source: { kind: 'catalogue-model', assetId: asset.id },
			admission: exclusions.length === 0 ? 'admitted' : 'excluded',
			exclusions,
			footprintSource: validateAssetFootprint(asset.footprint) === null ? 'catalogue-footprint' : 'none',
			contactSource: record?.contactSource ?? 'none',
			nonUnitSourceNormalization: record?.nonUnitSourceNormalization ?? false
		});
	}
	return entries;
}

/** Admitted definition keys, in inventory order. */
export function admittedDefinitionKeys(manifest: readonly Asset[] = assets): readonly string[] {
	return objectDefinitionInventory(manifest)
		.filter((entry) => entry.admission === 'admitted')
		.map((entry) => entry.definitionKey);
}

/**
 * Catalogue models whose only outstanding gate is the r186 contact verification.
 *
 * These are candidates for admission, not admitted definitions: they carry a
 * declared footprint and contact but no recorded verification.
 */
export function pendingVerificationDefinitionKeys(manifest: readonly Asset[] = assets): readonly string[] {
	return objectDefinitionInventory(manifest)
		.filter((entry) => entry.admission === 'excluded')
		.filter((entry) => entry.exclusions.length === 1 && entry.exclusions[0]!.code === 'unverified-model-contact')
		.map((entry) => entry.definitionKey);
}

export function nativeDefinitionKey(primitive: NativePlacementPrimitive): string {
	return `native:${primitive}`;
}

export function modelDefinitionKey(assetId: string): string {
	return `model:${assetId}`;
}

/** The admitted native definition of one primitive, with its captured metadata identity. */
export async function nativePlacementDefinition(
	primitive: NativePlacementPrimitive
): Promise<NormalizedPlacementDefinition> {
	const facts = {
		definitionKey: nativeDefinitionKey(primitive),
		admission: nativeAdmission(primitive),
		footprintMeters: nativeFootprint(primitive),
		contactMinY: nativePlacementContactMinY(primitive),
		creationDefaults: nativeCreationDefaults(primitive),
		renderNormalization: { defaultScale: 1 }
	};
	return { ...facts, metadataContentId: await definitionMetadataContentId(facts) };
}

/**
 * The normalized definition of one catalogue model, or `null` when it is not admitted.
 *
 * Returning `null` for an excluded model is deliberate: a caller must not be
 * able to receive a definition for a model whose contact and footprint are
 * unverified, because a labelled placeholder that silently became an accepted
 * fallback placement is exactly the failure this gate exists to prevent.
 */
export async function catalogueModelDefinition(
	assetId: string,
	manifest: readonly Asset[] = assets
): Promise<NormalizedPlacementDefinition | null> {
	const asset = findAsset(manifest, assetId);
	if (asset === undefined) return null;
	if (catalogueModelExclusions(asset).length > 0) return null;
	const record = contactRecordFor(assetId);
	const verificationId = record?.verificationId;
	if (record === undefined || verificationId === undefined) return null;
	const facts = {
		definitionKey: modelDefinitionKey(asset.id),
		admission: {
			operations: ['place-object'] as const,
			supportedSurfaces: ['floor'] as const,
			uprightOnly: true,
			provenance: { kind: 'verified-model' as const, verificationId },
			exclusions: []
		} satisfies ObjectDefinitionAdmission,
		footprintMeters: normalizeAssetFootprintOutline(asset.footprint!),
		contactMinY: record.contactMinY,
		creationDefaults: {
			kind: 'model' as const,
			name: asset.name,
			assetId: asset.id,
			fallback: resolveAssetFallback(asset)
		} satisfies ObjectCreationDefaults,
		renderNormalization: {
			defaultScale: asset.defaultScale,
			...(asset.defaultRotation === undefined
				? {}
				: { defaultRotation: [...asset.defaultRotation] as [number, number, number] })
		}
	};
	return { ...facts, metadataContentId: await definitionMetadataContentId(facts) };
}

/**
 * Whether one catalogue asset may back a **new** placement definition.
 *
 * This is admission for new placement only. It is not a replacement for the
 * Scene reader's `isKnownAssetId` seam: existing documents may reference assets
 * this phase excludes, and invalidating them is not this policy's decision —
 * the host integration that consumes this function is `T2.P01.S03`'s.
 */
export function isAdmittedPlacementAssetId(assetId: string, manifest: readonly Asset[] = assets): boolean {
	const asset = findAsset(manifest, assetId);
	if (asset === undefined) return false;
	return catalogueModelExclusions(asset).length === 0;
}

/** Every reason one catalogue asset is excluded, in a fixed reviewable order. */
export function catalogueModelExclusions(asset: Asset): readonly ObjectDefinitionExclusion[] {
	const exclusions: ObjectDefinitionExclusion[] = [];
	if (asset.placementSurface !== 'floor') {
		exclusions.push({
			code: 'unsupported-placement-surface',
			reason: `Declared placement surface is "${asset.placementSurface}", not "floor".`
		});
	}
	if (asset.status !== 'approved') {
		exclusions.push({
			code: 'unapproved-asset-status',
			reason: `Asset status is "${asset.status}"; only approved assets are admitted for placement.`
		});
	}
	const footprintIssue = validateAssetFootprint(asset.footprint);
	if (footprintIssue !== null) {
		exclusions.push({ code: 'missing-footprint-metadata', reason: footprintIssue });
	}
	const record = contactRecordFor(asset.id);
	if (record?.verificationFailure) {
		exclusions.push({ code: 'model-geometry-mismatch', reason: `${record.verificationFailure.verificationId}: ${record.notes}` });
	}
	if (record === undefined) {
		exclusions.push({
			code: 'missing-contact-record',
			reason: 'No declared floor-contact record exists for this asset.'
		});
	} else if (!record.verified || record.verificationId === undefined) {
		exclusions.push({
			code: 'unverified-model-contact',
			reason: `Contact is declared from "${record.contactSource}" but not verified on the landed r186 loader base; ${record.notes}`
		});
	}
	return exclusions;
}

function contactRecordFor(assetId: string): CatalogueModelContactRecord | undefined {
	return CATALOGUE_MODEL_CONTACT_RECORDS.find((record) => record.assetId === assetId);
}

function findAsset(manifest: readonly Asset[], assetId: string): Asset | undefined {
	return manifest.find((asset) => asset.id === assetId);
}

function nativeAdmission(primitive: NativePlacementPrimitive): ObjectDefinitionAdmission {
	return {
		operations: ['place-object'],
		supportedSurfaces: ['floor'],
		uprightOnly: true,
		provenance: {
			kind: 'analytical',
			detail:
				primitive === 'sphere'
					? 'Centered sphere: contactMinY = -radius.'
					: 'Centered primitive: contactMinY = -height/2.'
		},
		exclusions: [PLANE_EXCLUSION]
	};
}

/** The declared floor contact of one native primitive, in placement-local meters. */
export function nativePlacementContactMinY(primitive: NativePlacementPrimitive): number {
	if (primitive === 'sphere') return -NATIVE_PLACEMENT_DIMENSIONS.sphere.radius;
	if (primitive === 'cylinder') return -NATIVE_PLACEMENT_DIMENSIONS.cylinder.height / 2;
	return -NATIVE_PLACEMENT_DIMENSIONS.box.height / 2;
}

function nativeFootprint(primitive: NativePlacementPrimitive): LayoutVec2[] {
	if (primitive === 'sphere') return circleFootprint(NATIVE_PLACEMENT_DIMENSIONS.sphere.radius);
	if (primitive === 'cylinder') return circleFootprint(NATIVE_PLACEMENT_DIMENSIONS.cylinder.radius);
	return rectangleFootprint(
		NATIVE_PLACEMENT_DIMENSIONS.box.width,
		NATIVE_PLACEMENT_DIMENSIONS.box.depth
	);
}

function nativeCreationDefaults(primitive: NativePlacementPrimitive): ObjectCreationDefaults {
	const materialId = 'plaster-warm' as const;
	if (primitive === 'sphere') {
		return {
			kind: 'primitive',
			primitive: 'sphere',
			name: 'Sphere',
			dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.sphere },
			materialId,
			castShadow: true,
			receiveShadow: true
		};
	}
	if (primitive === 'cylinder') {
		return {
			kind: 'primitive',
			primitive: 'cylinder',
			name: 'Column',
			dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.cylinder },
			materialId,
			castShadow: true,
			receiveShadow: true
		};
	}
	return {
		kind: 'primitive',
		primitive: 'box',
		name: 'Block',
		dimensions: { ...NATIVE_PLACEMENT_DIMENSIONS.box },
		materialId,
		castShadow: true,
		receiveShadow: true
	};
}

function rectangleFootprint(width: number, depth: number): LayoutVec2[] {
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	return [
		[-halfWidth, -halfDepth],
		[halfWidth, -halfDepth],
		[halfWidth, halfDepth],
		[-halfWidth, halfDepth]
	];
}

function circleFootprint(radius: number): LayoutVec2[] {
	return Array.from({ length: CIRCLE_STEPS }, (_, index) => {
		const angle = (Math.PI * 2 * index) / CIRCLE_STEPS;
		return [radius * Math.cos(angle), radius * Math.sin(angle)] as LayoutVec2;
	});
}
