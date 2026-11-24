import type { ComponentProps } from 'svelte';
import type StageCanvas from '../stage/shell/StageCanvas.svelte';
import type StageOverlay from '../stage/shell/StageOverlay.svelte';
import type StageViewportRegion from '../stage/shell/StageViewportRegion.svelte';
import type EditorHead from '../stage/shell/EditorHead.svelte';
import type StageToolbars from '../stage/shell/StageToolbars.svelte';
import type StagePanels from '../stage/shell/StagePanels.svelte';
import type { WorkspaceOwner } from './protocol';

export type RegionProps = {
	canvas: ComponentProps<typeof StageCanvas>;
	overlay: ComponentProps<typeof StageOverlay>;
	viewport: ComponentProps<typeof StageViewportRegion>;
	head: ComponentProps<typeof EditorHead>;
	toolbars: ComponentProps<typeof StageToolbars>;
	panels: ComponentProps<typeof StagePanels>;
};

export const REGION_LIST_KEYS = {
	marks: ['core', 'sky'],
	candidates: ['core', 'artwork']
} as const satisfies Partial<Record<keyof RegionProps['overlay'], readonly WorkspaceOwner[]>>;

export const REGION_KEY_OWNER = {
	canvas: {
		geometry: 'core',
		sourceContentId: 'core',
		layoutRevision: 'core',
		scene: 'appearance',
		lightPreview: 'core',
		evaluation: 'core',
		ghosts: 'core',
		modelUrls: 'core',
		textureScope: 'core',
		textureRevision: 'core',
		artworkScope: 'artwork',
		artworkGhost: 'artwork',
		onArtworkError: 'artwork',
		plan: 'core',
		planAppearance: 'core',
		paperInk2d: 'core',
		paperInk3d: 'core',
		drafting: 'core',
		contentBounds: 'core',
		snapshotBounds: 'core',
		sky: 'sky',
		framedViewport: 'core',
		datumMeters: 'core',
		selection: 'core',
		hover: 'core',
		hoverTone: 'core',
		proposals: 'appearance',
		dial: 'sky',
		scenePick: 'core',
		capturedPointers: 'core',
		liftedRoomIds: 'layout-readings',
		liftedRegionIds: 'layout-readings',
		liftSources: 'layout-readings',
		heightMeters: 'core',
		heightPlaneVisible: 'core',
		unfoldPinHovered: 'layout-readings',
		unfoldPinActive: 'layout-readings',
		unfoldAnchorPin: 'layout-readings',
		resolvedSlice: 'layout-readings',
		sliceDraft: 'layout-readings',
		cutawayWallIds: 'layout-readings',
		cutawayStubTopY: 'layout-readings',
		alignHiddenWallIds: 'appearance',
		onCutawayFailure: 'layout-readings',
		studio: 'studio',
		onFinishOutcome: 'appearance',
		repairAffectedTargets: 'appearance',
	},
	overlay: {
		celestial: 'sky',
		markers: 'core',
		marks: REGION_LIST_KEYS.marks,
		roomLabels: 'core',
		guides: 'core',
		candidates: REGION_LIST_KEYS.candidates,
		viewportWidth: 'core',
		viewportHeight: 'core',
		tracePreview: 'core',
		hostTools: 'core',
		sliceDraft: 'layout-readings',
		onActivateDisclosure: 'core',
		lightGround: 'core',
	},
	viewport: {
		previewing: 'experience',
		canvas: 'core',
		overlay: 'core',
		experienceMarks: 'experience',
		viewEditTurn: 'experience',
		scaleBar: 'core',
		heightSheet: 'core',
		lookThrough: 'core',
		lightCoverage: 'light-inspection',
		lift: 'layout-readings',
		slice: 'layout-readings',
		pendingViewWrite: 'experience',
		welcome: 'experience',
		hanging: 'artwork',
		artwork: 'artwork',
		notice: 'core',
		preview: 'experience',
		previewLoading: 'experience',
		stageCursor: 'core',
		styleCursor: 'core',
		paperVisible: 'core',
		homes: 'experience',
		input: 'core',
		onLaneWidth: 'core',
		onDismissWelcome: 'experience',
		onExperienceController: 'experience',
		onActivateDisclosure: 'core',
		onResolvePendingViewWrite: 'experience',
		onCancelPendingViewWrite: 'experience',
		stageElement: 'core',
		throughFrameElement: 'core',
	},
	head: {
		projectId: 'core',
		projectName: 'core',
		lens: 'experience',
		onLens: 'experience',
		canDownloadSource: 'core',
		onDownloadSource: 'core',
		onOpenSource: 'core',
		historyUnavailableReason: 'core',
		redoUnavailableReason: 'core',
		canUndo: 'core',
		canRedo: 'core',
		onUndo: 'core',
		onRedo: 'core',
		saveUnavailableReason: 'core',
		save: 'core',
		onReloadRemote: 'core',
		canPreview: 'experience',
		onPreview: 'experience',
		previewUnavailableReason: 'experience',
		indexOpen: 'core',
		onToggleIndex: 'core',
		locationLabel: 'core',
		onOpenIndex: 'core',
		projectActionsUnavailableReason: 'core',
		projectActionBusy: 'core',
		onPrepareRename: 'core',
		onRenameProject: 'core',
		onPrepareDelete: 'core',
		onDeleteProject: 'core',
		onProjectActionComplete: 'core',
		onProjectActionBusyChange: 'core',
		onRefreshRemoteProject: 'core',
		find: 'core',
		repairIssueCount: 'appearance',
		repairOpen: 'appearance',
		onToggleRepair: 'appearance',
	},
	toolbars: {
		previewing: 'experience',
		viewLine: 'experience',
		paintLine: 'appearance',
		show: 'core',
		world: 'core',
		instrument: 'core',
		experience: 'experience',
		onLowerColumnHeight: 'core',
	},
	panels: {
		previewing: 'experience',
		toolbars: 'core',
		rects: 'core',
		environment: 'sky',
		index: 'core',
		scrim: 'core',
		card: 'core',
		inactiveTask: 'core',
		keysOpen: 'core',
		onCloseScrim: 'core',
		onResumeTask: 'core',
		onCloseTask: 'core',
		onCloseKeys: 'core',
	},
} as const satisfies {
	[Region in keyof RegionProps]: {
		[Key in keyof RegionProps[Region]]-?: WorkspaceOwner | readonly WorkspaceOwner[];
	};
};

type Region = keyof RegionProps;
type Ownership = typeof REGION_KEY_OWNER;
type OwnersOf<Assignment> = Assignment extends readonly WorkspaceOwner[] ? Assignment[number] : Assignment;

type OwnedKeys<Owner extends WorkspaceOwner, Name extends Region> = {
	[Key in keyof Ownership[Name]]: Owner extends OwnersOf<Ownership[Name][Key]> ? Key : never;
}[keyof Ownership[Name]] & keyof RegionProps[Name];

export type RegionContribution<Owner extends WorkspaceOwner, Name extends Region> =
	Pick<RegionProps[Name], OwnedKeys<Owner, Name>>;

/** Keep the original getter object and reject keys assigned to another owner. */
export function contribution<Owner extends WorkspaceOwner, Name extends Region>() {
	return <Props extends RegionContribution<Owner, Name>>(
		props: Props & Record<Exclude<keyof Props, OwnedKeys<Owner, Name>>, never>
	): RegionContribution<Owner, Name> => props;
}
