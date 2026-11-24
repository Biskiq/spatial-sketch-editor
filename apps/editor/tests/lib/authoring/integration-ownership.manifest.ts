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
		consumers: { [layoutAdapter + 'layout-contributions.ts']: ['reading', 'lift', 'putBack'] }
	},
	{
		name: 'wallFace', module: layout + 'wall-face-store.ts',
		constructor: 'WallFaceStore', owners: [readings + 'wall-face-host.svelte.ts'],
		consumers: {
			[layoutAdapter + 'layout-contributions.ts']: ['isActive', 'face', 'putBack'],
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
