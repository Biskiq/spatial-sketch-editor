export {
	createUnitPlannerRegistry,
	createUnitTargetInspector,
	prepareUnitIntent,
	validateUnitTargets,
} from '../f4/unit-acceptance';

export type {
	ExecutionProgram,
	ProgramInvocation,
} from '../program/types';

export {
	SCENE_PALETTE_MAX_SLOTS,
	SCENE_SKY_PRESETS,
	SCENE_TREATMENTS,
} from '../scene';

export type {
	SceneColor,
	SceneEnvironment,
	ScenePaletteSlot,
	SceneSky,
	SceneSkyPreset,
	SceneTreatment,
} from '../scene';

export {
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	normalizeUnitEnvelope,
	UNIT_ACCEPTANCE_SCOPE,
	UNIT_ENVELOPE_SOURCE_FORMAT,
	UNIT_ENVELOPE_SOURCE_KIND,
	UNIT_ENVELOPE_SOURCE_VERSION,
	verifyUnitDependencyLocks,
} from './acceptance';

export type {
	UnitAcceptanceAdapterOptions,
	UnitAcceptancePreparationOptions,
	VerifyDependencyLocksOptions,
} from './acceptance';

export {
	stageUnitResources,
} from './acceptance-staging';

export type {
	StagedUnitResource,
	UnitResourceStaging,
} from './acceptance-staging';

export {
	CAMERA_UNIT_SCENE_VALIDATION,
} from './camera-connectivity';

export {
	canonicalUnitBytes,
	canonicalUnitJson,
	computeEnvelopeSourceContentId,
	computeUnitContentRevision,
	createDomainUnit,
	createProjectEnvelope,
	createUnitHeader,
	envelopeSourceCore,
	verifyUnitContentRevisions,
} from './canonical';

export type {
	ContentRevisionMismatch,
	ProjectEnvelopeInput,
	SaveWorkInstrumentation,
} from './canonical';

export {
	cameraUnit,
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitEnvelope,
	createEmptyUnitSceneDocument,
	experienceUnit,
	layoutUnit,
	replaceUnitData,
	resourceUnit,
	sceneUnit,
	serializeUnitEnvelope,
} from './envelope';

export {
	GUIDE_KEEPS_A_STOP_REASON,
	normalizeTransitions,
	planGuideRemoval,
	planPresentationRemoval,
	planPresentationViewRemoval,
	planStopRemoval,
	PRESENTATION_KEEPS_A_VIEW_REASON,
	requiredTravelPairs,
	travelPairs,
	unlinkSceneSubject,
	unlinkSceneSubjects,
} from './experience-structure';

export type {
	ExperienceNormalisedCut,
	ExperienceRemovalConsequence,
	ExperienceRemovalPlan,
	ExperienceRemovalRefusalCode,
	ExperienceTravelPair,
} from './experience-structure';

export {
	buildExperienceCompanion,
} from './experience/companion';

export type {
	CompanionDestination,
	ExperienceCompanion,
} from './experience/companion';

export {
	createExperienceInterpreter,
	createExperienceRun,
	EXPERIENCE_RESUME_LEAD_IN_MS,
	isExploring,
	reduceExperience,
	replayExperience,
} from './experience/interpreter';

export type {
	ExperienceDetourPolicy,
	ExperienceEffect,
	ExperienceEvent,
	ExperienceInterpreterOptions,
	ExperiencePanel,
	ExperienceReduceOutcome,
	ExperienceReduceResult,
	ExperienceRunPhase,
	ExperienceRunState,
	ExperienceSuspendedVisit,
	ExperienceTransition,
	ExperienceVisit,
} from './experience/interpreter';

export {
	lowerExperienceProgram,
} from './experience/lowering';

export type {
	ExperienceLoweringAction,
	ExperienceLoweringOptions,
	ExperienceLoweringRefusal,
	ExperienceLoweringResult,
	ExperienceProgramTransition,
} from './experience/lowering';

export {
	deriveExperienceRuntimePolicy,
} from './experience/policy';

export type {
	ExperienceRuntimePolicy,
	ExperienceRuntimePolicyResult,
} from './experience/policy';

export {
	sameSkyIgnoringHeading,
	SCENE_LOOK_IDS,
	SCENE_LOOK_STARTS,
	sceneLookOf,
	sceneLookPaletteSlots,
	sceneLookStart,
} from './look-presets';

export type {
	SceneLookId,
	SceneLookPaletteEntry,
	SceneLookStart,
} from './look-presets';

export {
	checkEnvelopeMaterialProof,
	verifyEnvelopeMaterialDigests,
} from './material-digests';

export type {
	EnvelopeMaterialProofResult,
} from './material-digests';

export {
	materialRuntimeIndexOf,
} from './material-index';





export {
	prepareUnitRuntime,
	prepareValidatedUnitRuntime,
} from './runtime';

export type {
	RetainedUnitRuntime,
	UnitRuntimePreparation,
	UnitRuntimeReady,
	UnitRuntimeRejection,
	ValidatedProjectEnvelope,
} from './runtime';

export {
	captureUnitSave,
	createUnitSaveHandler,
	readUnitEnvelopeForSave,
	UNIT_SAVE_SCOPE,
	UNIT_SAVE_SOURCE_KIND,
	UNIT_SAVE_SOURCE_VERSION,
} from './save';

export type {
	UnitSaveCapture,
	UnitSaveRefusal,
} from './save';

export {
	sameSky,
	SCENE_SKY_DEFAULT,
	SCENE_SKY_PRESET_STARTS,
	skyFromPreset,
	skyIsEdited,
	sunShadowRadius,
} from './sky-presets';

export {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
} from './source';

export {
	ADMITTED_UNIT_VERSIONS,
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_GUIDE_PACINGS,
	EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH,
	EXPERIENCE_STAY_DEFAULT_SECONDS,
	EXPERIENCE_STAY_MIN_SECONDS,
	EXPERIENCE_TEXT_KINDS,
	EXPERIENCE_TEXT_MAX_LENGTH,
	EXPERIENCE_TRANSITIONS,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	EXPERIENCE_WELCOME_MAX_LENGTH,
	LAYOUT_UNIT_FORMAT_VERSION,
	MODEL_DERIVATIVE_MAX_BYTES,
	MODEL_RESOURCE_MIME,
	MODEL_SOURCE_SET_MAX_BYTES,
	presentationDefaultViewId,
	presentationDisplayName,
	presentationViewIds,
	RESOURCE_KINDS,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	stopEntryViewId,
	UNIT_DOMAINS,
	UNIT_ENVELOPE_FORMAT_VERSION,
} from './types';

export type {
	CameraFreeSceneDocument,
	CameraUnitPayload,
	CameraView,
	DependencyLock,
	DependencyLockEntry,
	DomainUnit,
	Experience,
	ExperienceDetour,
	ExperienceGuide,
	ExperienceGuidePacing,
	ExperienceInvitation,
	ExperiencePresentation,
	ExperiencePresentationText,
	ExperiencePresentationView,
	ExperienceStop,
	ExperienceTransitionKind,
	ExperienceUnitPayload,
	LayoutUnitPayload,
	MaterialResourceDetail,
	MaterialResourceImage,
	ModelPlacement,
	ModelRefineRecipe,
	ModelResourceDetail,
	ModelSourcePin,
	PayloadOf,
	ProjectEnvelope,
	ProjectUnits,
	RequiredCapability,
	ResourceKind,
	ResourcePin,
	ResourceUnitPayload,
	SceneEnvironmentChoice,
	TypedResource,
	UnitDomain,
	UnitHeader,
	UnitPayload,
	UnresolvedBinding,
} from './types';

export {
	freezePlainJsonSubgraph,
	isDeeplyFrozenPlainJson,
	readExperienceText,
	readInvitation,
	readPresentationViews,
	readStaySeconds,
	serializeProjectEnvelope,
	serializeValidatedProjectEnvelope,
	validateCameraFreeScenePayload,
	validateCameraPayload,
	validateDependencyLock,
	validateExperiencePayload,
	validateLayoutPayload,
	validateProjectEnvelope,
	validateResourcePayload,
	validateSceneSky,
	validateUnitPayload,
	validateUnresolvedBinding,
} from './validate';

export type {
	EnvelopeClosureFinding,
	EnvelopeDiagnostic,
	EnvelopeValidation,
} from './validate';
