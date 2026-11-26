/**
 * Shipped-static compatibility registry (checked-in allowlist).
 *
 * Thin visitor-safe facade over the canonical registry in
 * `@portfolio/project-model`: stable logical identities keyed by logical URI
 * / asset ID, never by bundler hash URLs. A shipped resource referenced by an
 * existing release may not be removed or renamed without retaining a
 * compatible mapping/file. The registry is append-only; bump
 * `SHIPPED_STATIC_REGISTRY_VERSION` when adding entries.
 *
 * Deliberately self-contained — it never reads the live catalogue, so an
 * existing release keeps resolving after a later catalogue or deploy change.
 */
export {
	getShippedMaterialById,
	getShippedModelByAssetId,
	isAllowedShippedModelFile,
	isAllowedShippedTextureUri,
	isKnownShippedAssetId,
	isKnownShippedMaterialId,
	isShippedFallback,
	listShippedAssetIds,
	listShippedMaterialIds,
	listShippedModelFiles,
	listShippedTextureUris,
	SHIPPED_MATERIALS,
	SHIPPED_MODELS,
	SHIPPED_TEXTURES,
	type ShippedMaterialEntry,
	type ShippedModelEntry,
	type ShippedTextureEntry,
} from '@portfolio/project-model/package';

export const SHIPPED_STATIC_REGISTRY_VERSION = 1;
