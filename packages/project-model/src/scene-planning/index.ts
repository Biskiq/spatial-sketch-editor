export {
	evaluateSceneForm,
	sceneFormContactMinY,
} from '../form';

export {
	applySurfaceLineage,
	newlyRetiredSurfaceReferenceKeys,
	retiredSurfaceReferenceKeys,
	surfaceLineageConsequence,
} from '../surface-lineage';

export type {
	SurfaceLineageReport,
	SurfaceLineageResult,
} from '../surface-lineage';

export {
	ARTWORK_DUPLICATE,
	ARTWORK_IMPORT,
	ARTWORK_PLACE,
	ARTWORK_REPLACE,
	ARTWORK_TRANSFORM,
	createArtworkPlanners,
} from './artwork-planners';

export {
	coatColourLabel,
	coatColourOf,
	coatKeepsRelief,
	coatMaterialLabel,
	coatRecipe,
	coatSourceOf,
	MODEL_OWN_COAT_REFUSAL,
	planColourCoats,
	sameCoatRecipe,
	UNASSIGNED_SURFACE_COAT_BASE,
} from './finish/colour-coat';

export type {
	CoatAssignment,
	CoatRecipe,
	CoatRefusal,
	CoatSource,
	CoatTarget,
	ColourCoatPlan,
} from './finish/colour-coat';

export {
	analysisRequestOf,
	analysisSubjectOf,
	entityUserKey,
	envelopeImageIndex,
	finishIdIsReferenced,
	finishUsersWithLifecycle,
	inspectFinish,
	isFinishTarget,
	qualifyFinishUsers,
	resolveEnvelopeFinish,
	surfaceUserKey,
} from './finish/inspect';

export type {
	FinishInspection,
	FinishOperation,
	FinishUserKey,
	InspectedFinishUser,
} from './finish/inspect';

export {
	applyFinishEdit,
	baseMaterialIdOf,
	catalogueBaseOf,
	colorMapOf,
	curatedIdOf,
	effectiveColorOf,
	fallbackFinishLabel,
	findIdenticalFinish,
	FINISH_MODEL_OWN,
	FINISH_PREVIEW_INSTANCE_ID,
	finishEditIsNoop,
	finishKeyOfRef,
	finishKeyOfSurface,
	finishOf,
	finishRefOfKey,
	followerSlotOf,
	isFinishPaintable,
	isPristineInstance,
	literalColorOf,
	literalizePaletteFollowers,
	materialBaseOf,
	materialInstanceById,
	metalReading,
	nextFinishName,
	nextPaletteName,
	PALETTE_ID_MAX_LENGTH,
	PALETTE_NAME_MAX_LENGTH,
	paletteFollowers,
	paletteHasRoom,
	projectIdOf,
	surfaceFinishFor,
	usersOfFinish,
	withFinishInstancePreview,
} from './finish/model';

export type {
	FinishEntity,
	FinishInstancePreview,
	FinishKey,
	FinishScene,
	FinishTargetKind,
	FinishUser,
	MetalReading,
	SceneFinishEdit,
	SceneFinishRef,
} from './finish/model';

export {
	applyFinishPatch,
	baseRecipeOf,
	FINISH_PATCH_FACTOR_FIELDS,
	FINISH_PATCH_FIELDS,
} from './finish/patch';

export type {
	FinishPatchEdit,
	FinishPatchFactorField,
	FinishPatchField,
	FinishPatchMapField,
	FinishPatchProblem,
	FinishPatchResult,
} from './finish/patch';

export {
	createFinishPlanners,
	FINISH_NAME_MAX_LENGTH,
	SCENE_COLOUR_COAT,
	SCENE_FINISH_ASSIGN,
	SCENE_FINISH_EDIT,
	SCENE_FINISH_FROM_IMAGE,
	SCENE_FINISH_PATCH,
	SCENE_FINISH_REGISTER,
	SCENE_FINISH_REMOVE,
	SCENE_FINISH_RENAME,
	SCENE_PALETTE_ADOPT,
	SCENE_PALETTE_SLOT_ADD,
	SCENE_PALETTE_SLOT_REMOVE,
	SCENE_PALETTE_SLOT_RENAME,
	SCENE_PALETTE_SLOT_SET,
	SCENE_SURFACE_FINISH_ASSIGN,
} from './finish';

export type {
	FinishAssignDerive,
	FinishPlanDiagnostic,
	FinishPlannerOptions,
} from './finish';

export {
	baseTileMeters,
	colourModeEdits,
	DEFAULT_SHEEN_TARGETS,
	defaultColourMode,
	editsToward,
	finishColourLabel,
	finishColourMode,
	finishHasColourImage,
	finishMaterialLabel,
	finishSheenReading,
	finishSheenScan,
	finishSheenTargets,
	generatedFinishName,
	isGeneratedFinishName,
	SHEEN_STEP_LABELS,
	SHEEN_STEP_TOLERANCE,
	sheenStepEdits,
	swapEdits,
	swapOverrides,
	uniqueFinishName,
} from './finish/treatment';

export type {
	FinishColourMode,
	FinishNameContext,
	FinishSheenReading,
	FinishSheenScan,
	FinishSheenStep,
	FinishSource,
	FinishTreatmentFacts,
	SheenStepId,
	SheenTargets,
} from './finish/treatment';

export {
	frameDirectionFromWorld,
	frameDirectionToWorld,
	framePointFromWorld,
	framePointToWorld,
	frameYawFromWorld,
	frameYawToWorld,
	isFinitePlacementFrame,
} from './frame';

export {
	readSceneOperationAllocation,
	readSceneOperationPayload,
	readSceneOperationSubject,
	sceneEntityTargetProblem,
} from './intent-payload';

export type {
	SceneOperationPayload,
	SceneOperationSubject,
} from './intent-payload';

export {
	planCreateLight,
	planDuplicateLight,
	planUpdateLight,
} from './light-operations';

export type {
	LightUpdate,
	SceneLightKind,
} from './light-operations';

export {
	canonicalDefinitionMetadata,
	definitionMetadataContentId,
} from './metadata-identity';

export type {
	DefinitionMetadataFacts,
} from './metadata-identity';

export {
	approvedModelResources,
	CREATOR_MODEL_RECIPE,
	creatorModelDefinition,
	creatorModelDefinitionKey,
	creatorModelLockEntry,
	creatorModelResourceEntry,
	creatorModelResourcePayload,
	withCreatorModelResource,
} from './model-resource';

export type {
	CreatorModelResourceEntry,
	CreatorModelResourcePayload,
} from './model-resource';

export {
	DUPLICATE_OFFSET_METERS,
	finalizePlacedEntity,
	floorTransformSupport,
	FORM_GENERATOR_SCOPE_FIELD,
	FORM_SCALE_SCOPE_FIELD,
	planCreateForm,
	planDeleteOne,
	planDuplicateOne,
	planMoveHorizontal,
	planPlaceFormCopy,
	planPlaceOnFloor,
	planResizeOnFloor,
	planSetFormProfile,
	planSetFormSize,
	planSetLift,
	planSetName,
	planSetYaw,
	SCENE_LIFT_LIMIT_METERS,
	SCENE_NAME_LIMIT,
	SCENE_OPERATION_KINDS,
	sceneEntityLift,
	YAW_SCOPE_FIELD,
} from './operations';

export type {
	FloorTransformSupport,
	SceneOperationCandidate,
	SceneOperationContext,
	SceneOperationCorrespondence,
	SceneOperationKind,
	SceneOperationRefusal,
	SceneOperationRefusalCode,
	SceneOperationResult,
	SceneOperationSupportEvidence,
} from './operations';

export {
	hexToLab,
	nearestSlot,
	planPaletteAdoption,
} from './palette-adoption';

export type {
	PaletteAdoptionPlan,
	PaletteAdoptionRow,
} from './palette-adoption';

export {
	preparePlaceObjectCandidate,
} from './place-object';

export type {
	PlacementSupportEvidence,
	PlaceObjectCandidate,
	PlaceObjectInput,
	PlaceObjectRefusalCode,
	PlaceObjectResult,
	PlaceObjectSupportInput,
	PlaceObjectWorldPose,
} from './place-object';

export {
	createScenePlanners,
} from './planners';

export type {
	ScenePlannerOptions,
} from './planners';

export {
	checkSceneRecordScope,
	finalizeSceneCandidate,
	sameSceneValues,
} from './record-scope';

export type {
	SceneCandidateFinalization,
	SceneRecordScope,
} from './record-scope';

export {
	countSceneRootsOnFloorRegion,
	sceneRootContactMinY,
} from './region-contact';

export {
	resolveSceneSupport,
	resolveSceneSupportOnGeometry,
	sceneSupportGenerationId,
	selectSceneSupport,
} from './support';

export type {
	SceneSupportChoice,
	SceneSupportResolution,
	SceneSupportSelection,
} from './support';

export {
	FINISH_TEXTURE_MIMES,
	finishTextureResource,
	finishTextureUri,
	isFinishTexturePin,
	sameFinishTexturePin,
	withFinishTextureResource,
} from './texture-resource';

export type {
	FinishTextureMime,
	FinishTexturePin,
} from './texture-resource';

export type {
	LocalInputFrame,
	ModelObjectCreationDefaults,
	NativeObjectCreationDefaults,
	NormalizedPlacementDefinition,
	ObjectContactProvenance,
	ObjectCreationDefaults,
	ObjectDefinitionAdmission,
	ObjectDefinitionExclusion,
	PlacementSurface,
	RenderNormalizationIdentity,
} from './types';
