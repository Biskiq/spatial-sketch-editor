/**
 * `@portfolio/project-model/materials` — the portable
 * `pbr-metallic-roughness/v1` contract.
 *
 * Runtime-safe by construction: no Three, Svelte, DOM or editor import. The
 * editor, API and visitor can each read a recipe, resolve sparse overrides,
 * bind a target or qualify a delivery from this subpath.
 */
export {
	MATERIAL_CAPABILITY,
	MATERIAL_MAP_ROLES,
	MATERIAL_NEUTRAL_BASE_ID,
	MATERIAL_PROFILE,
	SCALAR_COMPONENTS,
	type BindingTarget,
	type BoundFinish,
	type BoundInputs,
	type CatalogueBaseRef,
	type Colour,
	type FieldProvenance,
	type Finish,
	type FinishBase,
	type FinishBinding,
	type FinishColor,
	type FinishOverrides,
	type FinishProvenance,
	type FinishResolution,
	type Hash,
	type LocalImage,
	type MapRole,
	type Mapping,
	type Maps,
	type MaterialBaseRef,
	type MaterialNeutralBaseId,
	type MaterialProfile,
	type Metric,
	type Normal,
	type NormalConvention,
	type OverrideMaps,
	type PaletteSlot,
	type Recipe,
	type ResolvedColour,
	type ResolvedImage,
	type ResolvedMaps,
	type ResolvedNormal,
	type ResolvedScalar,
	type SamplingEntry,
	type Scalar,
	type ScalarComponent,
	type ScalarField,
	type SurfaceMapping,
	type TargetDraw,
	type TargetFacts,
	type TargetMapping,
	type TargetMetricBasis,
	type UvMapping,
	type ValueSource
} from './types';

export {
	MATERIAL_ISSUE_CODES,
	compareMaterialIssues,
	dedupeMaterialIssues,
	sortMaterialIssues,
	type MaterialIssue,
	type MaterialIssueCode
} from './issues';

export {
	finishIdentityKey,
	isColourLiteral,
	isHash,
	isPristineFinish,
	normalizeOffset,
	normalizeRotation,
	pruneOverrides,
	readFinish,
	readOverrides,
	readRecipe,
	type FinishReadResult,
	type OverridesReadResult,
	type RecipeReadResult
} from './read';

export {
	NEUTRAL_RECIPE,
	NEUTRAL_RECIPE_HASH,
	canonicalRecipeBytes,
	canonicalRecipeJson,
	mappingOfBinding,
	materialMetricRepeat,
	readRecipeWithHash,
	recipeHash
} from './recipe';

export {
	CATALOGUE_BASE_IDS,
	CATALOGUE_MATERIAL_IDS,
	SHIPPED_MATERIAL_IMAGES,
	catalogueMaterial,
	catalogueMaterials,
	catalogueRecipe,
	catalogueRenderFacts,
	isCatalogueMaterialId,
	shippedImage,
	shippedImageByHash,
	type CatalogueImage,
	type CatalogueMaterial,
	type CatalogueMaterialId,
	type CatalogueRenderFacts
} from './catalogue';

export {
	createImageIndex,
	materialImageIndex,
	mergeImageIndexes,
	resolveFinish,
	shippedImageIndex,
	type ImageIndex,
	type ResolveBase
} from './resolve';

export {
	intersectTargetAvailability,
	summarizeDrawGeometry,
	targetHasDraws,
	type AvailabilityIntersection,
	type DrawGeometry
} from './target';

export {
	bindFinish,
	qualifyAcrossTargets,
	type AcrossTargetsQualification,
	type TargetQualification
} from './bind';

export {
	sceneFinishToContract,
	type SceneFinishAdaptation,
	type SceneFinishSource
} from './scene-finish';
