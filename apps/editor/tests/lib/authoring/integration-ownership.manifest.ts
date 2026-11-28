/**
 * X9 ownership manifest.
 *
 * One policy table for the feature layer. The guards read this file; the
 * lifecycle and Escape order stay in their source tables.
 */
export type FeatureManifestEntry = {
	readonly id: string;
	readonly entry: string;
	readonly subOwners: readonly string[];
	readonly regions: readonly string[];
	readonly viewType?: string;
};

export const FEATURES: readonly FeatureManifestEntry[] = [
	{
		id: 'appearance',
		entry: 'src/lib/authoring/look/appearance-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/look/appearance/card-session.svelte.ts',
			'src/lib/authoring/look/appearance/paint-session.svelte.ts',
			'src/lib/authoring/look/appearance/import-session.svelte.ts',
			'src/lib/authoring/look/appearance/library-draft-session.svelte.ts',
			'src/lib/authoring/look/appearance/align-session.svelte.ts',
			'src/lib/authoring/look/appearance/repair-session.svelte.ts',
			'src/lib/authoring/look/appearance/operations.ts',
			'src/lib/authoring/look/appearance/canvas-region.ts',
			'src/lib/authoring/look/appearance/finish-authority.ts'
		],
		regions: [
			'src/lib/authoring/look/AppearanceWorldRegions.svelte',
			'src/lib/authoring/look/AppearanceSharedRegions.svelte'
		],
		viewType: 'src/lib/authoring/look/appearance-view.ts'
	},
	{
		id: 'artwork',
		entry: 'src/lib/authoring/artwork/artwork-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/artwork/artwork-host.svelte.ts',
			'src/lib/authoring/stage/route/stage-artwork-interaction.svelte.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/artwork/artwork-view.ts'
	},
	{
		id: 'experience',
		entry: 'src/lib/authoring/experience/experience-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/stage/route/stage-experience-binding.svelte.ts',
			'src/lib/authoring/experience/experience-region-views.svelte.ts',
			'src/lib/authoring/experience/experience-host-ports.svelte.ts',
			'src/lib/authoring/experience/experience-preview-host.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/experience/experience-view.ts'
	},
	{
		id: 'layout-readings',
		entry: 'src/lib/authoring/stage/readings/layout-readings-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/stage/readings/unfold-host.svelte.ts',
			'src/lib/authoring/stage/readings/slice-host.svelte.ts',
			'src/lib/authoring/stage/readings/lift-host.svelte.ts',
			'src/lib/authoring/stage/readings/cutaway-host.svelte.ts',
			'src/lib/authoring/stage/readings/wall-face-host.svelte.ts',
			'src/lib/authoring/stage/readings/plan-parameters.svelte.ts',
			'src/lib/authoring/stage/readings/layout-readings-lifecycle.ts'
		],
		regions: []
	},
	{
		id: 'library',
		entry: 'src/lib/authoring/library/library-feature.svelte.ts',
		subOwners: ['src/lib/authoring/library/library-host.svelte.ts'],
		regions: ['src/lib/authoring/library/LibraryWorldRegion.svelte'],
		viewType: 'src/lib/authoring/library/library-view.ts'
	},
	{
		id: 'light-inspection',
		entry: 'src/lib/authoring/look/light-inspection-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/stage/route/light-look-through.svelte.ts',
			'src/lib/authoring/look/light-inspection/light-inspection-guards.svelte.ts',
			'src/lib/authoring/look/light-inspection/light-coverage.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/look/light-inspection-view.ts'
	},
	{
		id: 'sky',
		entry: 'src/lib/authoring/look/sky-feature.svelte.ts',
		subOwners: ['src/lib/authoring/look/sky/sky-host.svelte.ts'],
		regions: [],
		viewType: 'src/lib/authoring/look/sky-view.ts'
	},
	{
		id: 'studio',
		entry: 'src/lib/authoring/studio/studio-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/studio/studio-controller.svelte.ts',
			'src/lib/authoring/studio/studio-port.svelte.ts',
			'src/lib/authoring/studio/studio-find.svelte.ts',
			'src/lib/authoring/studio/studio-entry-session.svelte.ts',
			'src/lib/authoring/studio/studio-strips.svelte.ts',
			'src/lib/authoring/studio/studio-stage-ports.ts'
		],
		regions: ['src/lib/authoring/studio/StudioWorldRegions.svelte'],
		viewType: 'src/lib/authoring/studio/studio-view.ts'
	}
];

/** No feature needs a host-level compatibility phase. */
export const COMPAT_PHASES: readonly { feature: string; phase: string }[] = [];

const authoring = 'src/lib/authoring/';
const stage = authoring + 'stage/';
const core = stage + 'route/';
const shell = stage + 'shell/';
const workspace = authoring + 'workspace/';
const host = workspace + 'host/';
const wiring = host + 'wiring/';
const facade = stage + 'stage-facade.ts';
const binding = core + 'stage-experience-binding.svelte.ts';

export const SPATIAL_ROUTE = 'src/routes/project/[projectId]/spatial/+page.svelte';
export const WORKSPACE_HOST = host + 'workspace-host.svelte.ts';
export const WORKSPACE_COMPONENT = host + 'WorkspaceHost.svelte';

export const AUTHORITIES = [
	['createStageSession', stage + 'stage-session.ts', WORKSPACE_HOST],
	['createStageSessionLens', stage + 'stage-session-lens.svelte.ts', stage + 'stage-session.ts'],
	['createStageFacade', stage + 'stage-facade.ts', WORKSPACE_HOST],
	['createStageProjectEpoch', core + 'stage-project-epoch.svelte.ts', wiring + 'stage-project-epoch.ts'],
	['createProjectSession', authoring + 'project-session/project-session.svelte.ts', wiring + 'project-session.ts'],
	['createStageAssetLeases', core + 'stage-asset-leases.svelte.ts', WORKSPACE_HOST],
	['createStagePressTracker', stage + 'stage-input.ts', WORKSPACE_HOST],
	['createStageInputArbiter', core + 'stage-input.svelte.ts', wiring + 'stage-input.ts'],
	['createStageKeyboard', core + 'stage-keyboard.ts', wiring + 'stage-keyboard.ts'],
	['createStageUnfoldGestures', core + 'stage-unfold-gestures.svelte.ts', stage + 'readings/unfold-host.svelte.ts'],
	['createStageArtworkInteraction', core + 'stage-artwork-interaction.svelte.ts', authoring + 'artwork/artwork-feature.svelte.ts'],
	['createStageExperienceBinding', core + 'stage-experience-binding.svelte.ts', WORKSPACE_HOST],
	['createExperienceLens', authoring + 'experience/experience-lens.svelte.ts', core + 'stage-experience-binding.svelte.ts'],
	['createExperiencePlayback', authoring + 'experience/playback.svelte.ts', authoring + 'experience/experience-lens.svelte.ts'],
	['createExperiencePreview', authoring + 'experience/experience-preview.svelte.ts', authoring + 'experience/experience-preview-host.ts'],
	['createStageSelectionView', core + 'stage-selection-view.ts', core + 'stage-selection-presentation.svelte.ts'],
	['createWorldIndexModel', shell + 'world-index-model.ts', core + 'stage-selection-view.ts'],
	['createStageSelectionPresentation', core + 'stage-selection-presentation.svelte.ts', WORKSPACE_HOST],
	['stageDockView', core + 'stage-contribution-view.ts', core + 'stage-contribution-views.svelte.ts'],
	['stageFindView', core + 'stage-contribution-view.ts', core + 'stage-contribution-views.svelte.ts'],
	['createStageShellState', core + 'stage-shell-state.svelte.ts', wiring + 'stage-shell-state.ts'],
	['createStageShellCommands', core + 'stage-shell-commands.ts', wiring + 'stage-shell-commands.ts'],
	['createStageViewport', core + 'stage-viewport.svelte.ts', wiring + 'stage-viewport.ts'],
	['createStageHistoryCommand', core + 'stage-history-command.ts', WORKSPACE_HOST],
	['createStageWindowListeners', core + 'stage-window-listeners.ts', WORKSPACE_HOST],
	['createFeatureLifecycle', workspace + 'lifecycle-runner.ts', WORKSPACE_HOST],
	['late', workspace + 'protocol.ts', WORKSPACE_HOST],
	['createStudioController', authoring + 'studio/studio-controller.svelte.ts', authoring + 'studio/studio-feature.svelte.ts'],
	['createFinishAuthoring', authoring + 'look/finish-authoring.svelte.ts', authoring + 'look/appearance/finish-authority.ts']
] as const;

const layout = authoring + 'layout/';
const readings = stage + 'readings/';
const layoutAdapter = authoring + 'adapters/layout/';

/** Outside callers are tied to both the singleton binding and the members they use. */
export const SINGLETONS = [
	{
		name: 'experienceFocus', module: authoring + 'experience/focus.svelte.ts',
		constructor: 'ExperienceFocusState',
		owners: [core + 'stage-experience-binding.svelte.ts', authoring + 'experience/experience-controller.svelte.ts',
			authoring + 'experience/experience-feature.svelte.ts'],
		consumers: {}
	},
	{
		name: 'interiorLift', module: layout + 'interior-lift-store.svelte.ts',
		constructor: 'InteriorLiftStore', owners: [readings + 'lift-host.svelte.ts'],
		consumers: {
			[layoutAdapter + 'layout-contributions.ts']: ['reading', 'lift', 'putBack'],
			[layoutAdapter + 'layout-card-actions.ts']: ['reading', 'lift', 'putBack']
		}
	},
	{
		name: 'wallFace', module: layout + 'wall-face-store.ts',
		constructor: 'WallFaceStore', owners: [readings + 'wall-face-host.svelte.ts'],
		consumers: {
			[layoutAdapter + 'layout-contributions.ts']: ['isActive', 'face', 'putBack'],
			[layoutAdapter + 'layout-card-actions.ts']: ['isActive', 'face', 'putBack'],
			[layoutAdapter + 'LayoutRegionCard.svelte']: ['isActive', 'face', 'putBack'],
			[layoutAdapter + 'region-shape-lifecycle.ts']: ['isActive', 'putBack'],
			[authoring + 'look/finish-align.svelte.ts']: ['face', 'faceFloor', 'reframe', 'putBack']
		}
	},
	{
		name: 'wallUnfold', module: layout + 'wall-unfold-store.svelte.ts',
		constructor: 'WallUnfoldStore', owners: [readings + 'unfold-host.svelte.ts', readings + 'cutaway-host.svelte.ts'],
		consumers: {
			[layoutAdapter + 'LayoutCardFields.svelte']: ['state', 'anchorForWall', 'enter', 'exit'],
			[layoutAdapter + 'LayoutWallUnfold.svelte']: ['state', 'setU', 'flip', 'exit'],
			[layoutAdapter + 'curve-gesture-session.ts']: ['isActive'],
			[layoutAdapter + 'layout-contributions.ts']: ['isActive', 'state', 'presentationAngle'],
			[layoutAdapter + 'layout-marks.ts']: ['isActive'],
			[layoutAdapter + 'wall-scalar-session.ts']: ['isActive', 'state', 'presentationAngle'],
			[layoutAdapter + 'layout-card-actions.ts']: ['isActive', 'state', 'presentationAngle'],
			[core + 'stage-unfold-pick-geometry.ts']: ['presentationAngle', 'state'],
			[core + 'stage-unfold-gestures.svelte.ts']: [
				'anchorForWall', 'pinnedOpeningId', 'presentationAngle', 'previewOpening', 'recordPick',
				'setAnchor', 'setOpeningPreview', 'setU', 'state'
			],
			[shell + 'StageCanvas.svelte']: ['state'],
			[shell + 'StageWallDevelopment.svelte']: ['state', 'previewOpening', 'presentationAngle']
		}
	},
	{
		name: 'sliceReading', module: stage + 'slice/slice-reading.svelte.ts',
		constructor: 'SliceReadingStore', owners: [readings + 'slice-host.svelte.ts', stage + 'slice/slice-draw.svelte.ts'],
		consumers: {}
	},
	{
		name: 'nearWallCutaway', module: stage + 'cutaway/near-wall-cutaway.svelte.ts',
		constructor: 'NearWallCutawayStore', owners: [readings + 'cutaway-host.svelte.ts'],
		consumers: {}
	}
] as const satisfies readonly {
	readonly name: string;
	readonly module: string;
	readonly constructor: string;
	readonly owners: readonly string[];
	readonly consumers: Readonly<Record<string, readonly string[]>>;
}[];

export const REGION_MOUNTS = [
	['EditorHead', shell + 'EditorHead.svelte', WORKSPACE_COMPONENT],
	['StageProjectNotices', shell + 'StageProjectNotices.svelte', WORKSPACE_COMPONENT],
	['StageViewportRegion', shell + 'StageViewportRegion.svelte', WORKSPACE_COMPONENT],
	['StagePanels', shell + 'StagePanels.svelte', WORKSPACE_COMPONENT],
	['StageToolbars', shell + 'StageToolbars.svelte', WORKSPACE_COMPONENT],
	['StageCanvas', shell + 'StageCanvas.svelte', shell + 'StageViewportRegion.svelte'],
	['StageCamera', shell + 'StageCamera.svelte', shell + 'StageCanvas.svelte'],
	['EditorIndex', shell + 'EditorIndex.svelte', shell + 'StagePanels.svelte'],
	['EditorCard', shell + 'EditorCard.svelte', shell + 'StagePanels.svelte'],
	['ExperienceGuide', authoring + 'experience/ExperienceGuide.svelte', shell + 'StageToolbars.svelte'],
	['ExperienceDock', authoring + 'experience/ExperienceDock.svelte', shell + 'StageToolbars.svelte'],
	['StageDraftingControl', shell + 'StageDraftingControl.svelte', shell + 'StageToolbars.svelte'],
	['StageScaleBar', shell + 'StageScaleBar.svelte', shell + 'StageViewportRegion.svelte'],
	['StageHeightSheet', shell + 'StageHeightSheet.svelte', shell + 'StageViewportRegion.svelte']
] as const;

/**
 * The only dependency edges that bypass the D1/D9 layer rules, each with the
 * review reason it was admitted. An exception that no longer matches a live
 * edge fails the guard, so a resolved edge cannot leave a permanent hole.
 */
export const DEPENDENCY_EXCEPTIONS = [
	{
		from: 'stage/route/stage-input.svelte.ts',
		to: 'stage/route/stage-artwork-interaction.svelte.ts',
		typeOnly: true,
		why: 'The input arbiter reads the Artwork gesture port and never constructs it.'
	},
	{
		from: 'stage/route/look-through-frame.svelte.ts',
		to: 'stage/route/stage-experience-binding.svelte.ts',
		typeOnly: true,
		why: 'The frame arbitrates two inspection views and reads only the binding View methods it calls.'
	}
] as const;

/** Imports only the route may make (D5). */
export const ROOT_IMPORTS: Readonly<Record<string, readonly string[]>> = {
	[SPATIAL_ROUTE]: [
		'$app/state',
		'$lib/authoring/workspace/host/workspace-host.svelte',
		'$lib/authoring/workspace/host/WorkspaceHost.svelte'
	]
};

/**
 * The only elements a composition root may hold, with their allowed attributes.
 * A root otherwise composes components; a new element is a reviewed change.
 */
export const STRUCTURAL_ELEMENTS = {
	[SPATIAL_ROUTE]: [],
	[WORKSPACE_COMPONENT]: [
		{
			element: 'div',
			classes: ['editor-host', 'editor-body'],
			attributes: ['data-shell', 'data-index-open', 'data-library-open', 'style']
		}
	],
	[authoring + 'workspace/world/WorldLeading.svelte']: [],
	[authoring + 'workspace/world/WorldTrailing.svelte']: []
} as const satisfies Record<string, readonly {
	readonly element: string;
	readonly classes: readonly string[];
	readonly attributes: readonly string[];
}[]>;

/** Two-way bindings a root may expose; every target is a host member chain. */
export const ROOT_BINDINGS: Readonly<Record<string, readonly string[]>> = {
	[WORKSPACE_COMPONENT]: ['stageElement', 'throughFrameElement']
};

/**
 * Call ownership (CO). Each named operation is constructed or called only from
 * the listed modules. The list is generated from today's call sites and is
 * shrink-only: a new caller is a reviewed manifest change.
 */
export const CALL_OWNERS = [
	['createStageAcceptanceHost', stage + 'host-acceptance.ts', [core + 'stage-project-epoch.svelte.ts']],
	['mountStageAdapter', stage + 'stage-adapter-host.ts', [core + 'stage-project-epoch.svelte.ts']],
	['createStageAdapterServices', stage + 'stage-adapter-host.ts', [core + 'stage-project-epoch.svelte.ts', stage + 'stage-adapter-host.ts']],
	['resolveApprovedModels', authoring + 'scene/model-bytes.ts', [core + 'stage-asset-leases.svelte.ts']],
	['stageKeyAction', stage + 'stage-input.ts', [core + 'stage-keyboard.ts']],
	['stageKeyFromTextEntry', stage + 'stage-input.ts', [core + 'stage-keyboard.ts']],
	['stageKeyFromControl', stage + 'stage-input.ts', [core + 'stage-keyboard.ts']],
	['resizeArtworkAtRay', authoring + 'artwork/artwork-resize.ts', [core + 'stage-artwork-interaction.svelte.ts']],
	['artworkPlanePoint', authoring + 'artwork/artwork-resize.ts', [core + 'stage-artwork-interaction.svelte.ts']],
	['artworkPlacement', authoring + 'artwork/artwork-placement.ts', [core + 'stage-artwork-interaction.svelte.ts']],
	['pickWallUnfold', 'src/lib/layout/wall-unfold-pick.ts', [core + 'stage-unfold-gestures.svelte.ts']],
	['mapSheetOpeningDrag', 'src/lib/layout/wall-unfold-opening-drag.ts', [core + 'stage-unfold-gestures.svelte.ts']],
	// The shell places the projected pin using the same pure geometry as the gesture owner, and the
	// pointer station search projects the same top edge (a profiled top bends it).
	['wallUnfoldTopPoint', 'src/lib/layout/wall-unfold.ts', [core + 'stage-unfold-pick-geometry.ts', core + 'stage-unfold-gestures.svelte.ts', shell + 'StageWallDevelopment.svelte']],
	['setResolvedSlice', stage + 'slice/slice-resolved.ts', [readings + 'slice-host.svelte.ts']],
	['setResolvedCutaway', stage + 'cutaway/cutaway-resolved.ts', [readings + 'cutaway-host.svelte.ts']]
] as const;

/** Member-form call ownership (CO), matched on the call name and its object. */
export const MEMBER_CALL_OWNERS = [
	{ member: 'changeLens', callers: [facade, binding] },
	{ member: 'session.replace', callers: [core + 'stage-project-epoch.svelte.ts'] },
	{ member: 'leaveLens', callers: [WORKSPACE_HOST] },
	{ member: 'epoch.undo', callers: [core + 'stage-history-command.ts'] },
	{ member: 'epoch.redo', callers: [core + 'stage-history-command.ts'] },
	{ member: 'stageEpoch.undo', callers: [core + 'stage-history-command.ts'] },
	{ member: 'stageEpoch.redo', callers: [core + 'stage-history-command.ts'] },
	{ member: 'requestViewingIntent', callers: [
		facade, core + 'stage-viewing.ts', stage + 'camera-session.ts',
		readings + 'unfold-host.svelte.ts', authoring + 'experience/experience-lens.svelte.ts'
	] },
	{ member: 'experienceLens.install', callers: [binding] },
	{ member: 'artworkScope.dispose', callers: [
		core + 'stage-asset-leases.svelte.ts', 'src/lib/visitor/visitor-cold-runtime.ts',
		authoring + 'experience/experience-preview.svelte.ts'
	] },
	// The host adapts the project session's one acceptance port; the session invokes it.
	{ member: 'stageEpoch.activate', callers: [WORKSPACE_HOST, authoring + 'project-session/project-session.svelte.ts', core + 'stage-project-epoch.svelte.ts'] }
] as const;

/** Reactive cross-feature presenters, distinct from the construction wiring modules. */
export const WIRING_PRESENTERS = [
	wiring + 'stage-canvas-views.svelte.ts',
	wiring + 'stage-region-models.svelte.ts'
] as const;

/** Named bindings whose imports stay with one owner (CO for values, not calls). */
export const IMPORT_OWNERS = [
	{ name: 'stageAdapterFactories', owner: authoring + 'adapters/catalog.ts', callers: [WORKSPACE_HOST] }
] as const;

/**
 * The controller guarantee folded in from the retired
 * `authoring-controller-boundary` test: an extracted
 * controller may reach only the owner modules its contract names. The walk is
 * opaque at each approved boundary, exactly as the retired test applied it.
 */
export const CONTROLLER_BOUNDARIES = [
	{
		controller: core + 'stage-project-epoch.svelte.ts',
		approved: [
			stage + 'stage-adapter-host.ts', stage + 'stage-facade.ts', stage + 'host-acceptance.ts',
			stage + 'stage-session.ts', stage + 'unit-stage-source.ts', 'src/lib/platform/perf-marks.ts'
		]
	},
	{
		controller: core + 'stage-asset-leases.svelte.ts',
		approved: [
			authoring + 'scene/model-bytes.ts', 'src/lib/render/artwork/artwork-scope.ts',
			'src/lib/render/resources/project-texture-scope.ts', stage + 'stage-session.ts',
			stage + 'unit-stage-source.ts', stage + 'accepted-read.ts'
		]
	},
	{
		controller: core + 'stage-input.svelte.ts',
		approved: [
			stage + 'stage-input.ts', stage + 'stage-wheel-zoom.ts', stage + 'stage-glyphs.ts',
			stage + 'semantic-selection.ts', 'src/lib/platform/perf-marks.ts', '@portfolio/camera-core'
		]
	},
	{ controller: core + 'stage-keyboard.ts', approved: [stage + 'stage-input.ts'] },
	{
		controller: core + 'stage-unfold-gestures.svelte.ts',
		approved: [
			'src/lib/layout/wall-unfold.ts', 'src/lib/layout/wall-unfold-pick.ts',
			'src/lib/layout/wall-unfold-opening-drag.ts', authoring + 'layout/wall-unfold-store.svelte.ts',
			authoring + 'adapters/layout/precision.ts', authoring + 'adapters/layout/opening-planners.ts',
			stage + 'unit-stage-source.ts', '@portfolio/camera-core'
		]
	},
	{
		controller: core + 'stage-artwork-interaction.svelte.ts',
		approved: [
			authoring + 'artwork/artwork-resize.ts', authoring + 'artwork/artwork-hanging.ts',
			authoring + 'artwork/artwork-command.ts', authoring + 'artwork/artwork-placement.ts',
			authoring + 'artwork/artwork-wall-move.ts', authoring + 'artwork/artwork-authoring.svelte.ts',
			'packages/project-model/src/index.ts', '@portfolio/camera-core'
		]
	}
] as const;

export const CONTROLLER_FORBIDDEN_PREFIXES = [
	'src/lib/authoring/adapters/',
	'src/lib/authoring/f4/'
] as const;

export const CONTROLLER_FORBIDDEN_PACKAGES = [
	'packages/layout-core/src/kernel/index.ts',
	'packages/project-model/src/index.ts'
] as const;

/**
 * Shared-reading-state member classification (§4.3.1). Every member a module
 * touches must appear here. Only the lifetime owner may call lifecycle and sync
 * members; intent members are owner-only or declared consumers; reads are open.
 */
export const SINGLETON_MEMBERS = {
	experienceFocus: {
		lifecycle: ['reset'],
		sync: [],
		intent: ['openExperience', 'openGuide', 'select', 'previous', 'back'],
		read: ['stopId', 'presentationId', 'read', 'subject', 'experienceId', 'guideId']
	},
	interiorLift: {
		lifecycle: ['clear'],
		sync: ['setScope'],
		intent: ['lift', 'putBack'],
		read: ['reading', 'isActive']
	},
	wallFace: {
		lifecycle: ['clear', 'setCameraPort'],
		sync: [],
		intent: ['face', 'faceFloor', 'reframe', 'putBack'],
		read: ['reading', 'isActive']
	},
	wallUnfold: {
		lifecycle: ['setCameraExecutor'],
		sync: ['ensureAnchor', 'forgetAnchor', 'recordSettled'],
		intent: ['enter', 'exit', 'flip', 'setU', 'setAnchor', 'recordPick', 'setOpeningPreview', 'refold', 'cancelScrub'],
		read: ['state', 'presentationAngle', 'previewOpening', 'pinnedOpeningId', 'anchorForWall', 'isActive', 'lastPick', 'anchorsByWall']
	},
	sliceReading: {
		lifecycle: ['clear'],
		sync: [],
		intent: ['set', 'level', 'drawn', 'setDepth', 'flipDrawn', 'setDrawnDepth', 'setDrawnSegment', 'putBack'],
		read: ['reading', 'isActive']
	},
	nearWallCutaway: {
		lifecycle: ['reset'],
		sync: ['setHeld', 'evaluate', 'setSelectionHosts'],
		intent: ['setMode'],
		read: ['mode', 'held', 'decision', 'stubTopY', 'spaceId', 'classified', 'sticky', 'effective']
	}
} as const satisfies Record<(typeof SINGLETONS)[number]['name'], {
	readonly lifecycle: readonly string[];
	readonly sync: readonly string[];
	readonly intent: readonly string[];
	readonly read: readonly string[];
}>;
