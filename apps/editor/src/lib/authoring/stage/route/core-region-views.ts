import type { StageHeightSheet } from '../stage-height-sheet';
import type { StageLens } from '../stage-session';
import type { StageFacade } from '../stage-facade';
import type { StageReadSnapshot } from '../accepted-read';
import { PAPER_TONES } from '../paper-plan';
import type { StageSelectionEntry } from '../semantic-selection';
import {
	contribution,
	type RegionProps
} from '../../workspace/region-ownership';
import type { StageAssetLeases } from './stage-asset-leases.svelte';
import type { StageShellState } from './stage-shell-state.svelte';
import type { StageInputArbiter } from './stage-input.svelte';
import type { StageShellCommands } from './stage-shell-commands';
import type { createStageViewport } from './stage-viewport.svelte';
import type { createStageHistoryCommand } from './stage-history-command';
import type { createProjectSession } from '../../project-session/project-session.svelte';
import type { StageHistoryState } from '../host-acceptance';

type Viewport = ReturnType<typeof createStageViewport>;
type Canvas = RegionProps['canvas'];
type ViewportRegion = RegionProps['viewport'];
type PanelRegion = RegionProps['panels'];
type ToolbarRegion = RegionProps['toolbars'];
type ProjectSession = ReturnType<typeof createProjectSession>;

export function createCoreRegionViews(input: {
	readonly projectId: string;
	readonly heightSheet: StageHeightSheet;
	readonly project: ProjectSession;
	readonly facade: () => StageFacade | null;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly shell: StageShellState;
	readonly viewport: Viewport;
	readonly stageInput: StageInputArbiter;
	readonly commands: StageShellCommands;
	readonly history: Pick<ReturnType<typeof createStageHistoryCommand>, 'undo' | 'redo'>;
	readonly historyState: () => StageHistoryState;
	readonly scenePick: Canvas['scenePick'];
	readonly lightPreview: Canvas['lightPreview'];
	readonly assets: StageAssetLeases;
	readonly planAppearance: () => Canvas['planAppearance'];
	readonly paperContentBounds: () => Canvas['contentBounds'];
	readonly snapshotBounds: () => Canvas['snapshotBounds'];
	readonly selection: () => StageSelectionEntry | null;
	readonly studioSuppressesPlan: () => boolean;
	readonly lookThroughActive: () => boolean;
	readonly lens: () => StageLens;
	readonly previewing: () => boolean;
	readonly paperVisible: () => boolean;
	readonly cursor: () => ViewportRegion['stageCursor'];
	readonly lookThrough: () => ViewportRegion['lookThrough'];
	readonly viewportInput: ViewportRegion['input'];
	readonly canvas: () => ViewportRegion['canvas'];
	readonly overlay: () => ViewportRegion['overlay'];
	readonly downloadSource: () => void;
	readonly locationLabel: () => RegionProps['head']['locationLabel'];
	readonly findEntries: () => NonNullable<RegionProps['head']['find']>['entries'];
	readonly projectActionsUnavailableReason: () => RegionProps['head']['projectActionsUnavailableReason'];
	readonly index: () => PanelRegion['index'];
	readonly card: () => PanelRegion['card'];
	readonly inactiveTask: () => PanelRegion['inactiveTask'];
	readonly worldToolbar: () => ToolbarRegion['world'];
	readonly instrument: () => ToolbarRegion['instrument'];
	readonly show: () => ToolbarRegion['show'];
}) {
	const { shell, viewport, stageInput, assets, project, commands } = input;

	function canvas(snapshot: StageReadSnapshot) {
		return contribution<'core', 'canvas'>()({
			scenePick: input.scenePick,
			// A renderer recovery cancels actual captive pointers through the viewport.
			capturedPointers: stageInput.capturedPointers,
			lightPreview: input.lightPreview,
			geometry: snapshot.domain.geometry,
			sourceContentId: snapshot.sourceContentId,
			layoutRevision: snapshot.domain.unitRevisions.layout,
			get evaluation() { return viewport.evaluation; },
			get ghosts() { return viewport.ghosts; },
			get modelUrls() { return assets.urls; },
			get textureScope() { return assets.textureScope; },
			get textureRevision() { return assets.textureRevision; },
			get plan() { return input.studioSuppressesPlan() ? null : viewport.planView; },
			get planAppearance() { return input.planAppearance(); },
			get paperInk2d() { return PAPER_TONES[shell.preferences.paperTone2d].ink; },
			get paperInk3d() { return PAPER_TONES[shell.preferences.paperTone3d].ink; },
			get drafting() { return shell.drafting; },
			datumMeters: snapshot.domain.datumMeters,
			get contentBounds() { return input.paperContentBounds(); },
			get snapshotBounds() { return input.snapshotBounds(); },
			get framedViewport() { return input.lookThroughActive() ? viewport.framedViewport : null; },
			get selection() { return input.selection(); },
			get hover() {
				return shell.armedHostTool === 'erase' ? shell.eraseHover
					: shell.armedHostTool === 'paint' ? shell.paintHover
						: stageInput.hoverSelection;
			},
			get hoverTone() {
				return shell.armedHostTool === 'erase' ? 'erase' : shell.armedHostTool === 'paint' ? 'paint' : 'hover';
			},
			get heightMeters() { return input.lens() === 'world' ? shell.heightMeters : null; },
			get heightPlaneVisible() { return input.lens() === 'world' && shell.heightPlaneVisible; }
		});
	}

	function activateDisclosure(id: string): void {
		const stage = input.facade();
		if (stage?.activateDisclosure(id) === true) stage.notifySurfaceChange();
	}

	const overlay = contribution<'core', 'overlay'>()({
		get markers() { return viewport.markers; },
		get marks() { return viewport.marks; },
		get roomLabels() { return viewport.roomLabels; },
		get guides() { return viewport.guides; },
		get candidates() { return viewport.candidatePreviews; },
		get viewportWidth() { return viewport.rect?.width ?? 0; },
		get viewportHeight() { return viewport.rect?.height ?? 0; },
		get tracePreview() { return viewport.tracePreview; },
		get hostTools() { return shell.hostToolOverlay; },
		get lightGround() { return input.paperVisible() || viewport.evaluation?.renderedReading === '3d'; }
	});

	const head = contribution<'core', 'head'>()({
		projectId: input.projectId,
		get projectName() { return input.snapshot()?.domain.name ?? 'Loading project'; },
		get canDownloadSource() { return project.activeProject(); },
		onDownloadSource: input.downloadSource,
		onOpenSource: () => project.requestReplacement('source'),
		get historyUnavailableReason() { return input.historyState().undoUnavailableReason ?? 'Nothing to undo yet.'; },
		get redoUnavailableReason() { return input.historyState().redoUnavailableReason ?? 'Nothing to redo.'; },
		get canUndo() { return input.historyState().canUndo; },
		get canRedo() { return input.historyState().canRedo; },
		onUndo: input.history.undo,
		onRedo: input.history.redo,
		get save() { return project.headSave; },
		onReloadRemote: (offer) => void project.applyReloadOffer(offer),
		saveUnavailableReason: 'Conditional Save needs the cloud client; this session has none.',
		get indexOpen() { return shell.indexOpen; },
		onToggleIndex: () => shell.setIndexOpen(!shell.indexOpen),
		get locationLabel() { return input.locationLabel(); },
		onOpenIndex: () => shell.setIndexOpen(true),
		get projectActionsUnavailableReason() { return input.projectActionsUnavailableReason(); },
		get projectActionBusy() { return project.projectActionBusy; },
		onPrepareRename: () => project.prepareProjectLifecycle(false),
		onRenameProject: project.renameCurrentProject,
		onPrepareDelete: () => project.prepareProjectLifecycle(true),
		onDeleteProject: project.deleteCurrentProject,
		onProjectActionComplete: project.finishCurrentProjectAction,
		onProjectActionBusyChange: project.setProjectActionBusy,
		onRefreshRemoteProject: project.reloadLifecycleRemote,
		get find() {
			return {
				query: shell.findQuery,
				entries: input.findEntries(),
				onQuery: shell.setFindQuery,
				onRun: commands.runHeadFindEntry
			};
		}
	});

	const viewportRegion = contribution<'core', 'viewport'>()({
		get canvas() { return input.canvas(); },
		get overlay() { return input.overlay(); },
		get scaleBar() {
			return input.lens() === 'world' && viewport.evaluation?.projectionKind === 'plan-orthographic'
				? { bar: shell.draftingScaleBar, quiet: input.paperVisible() }
				: null;
		},
		get heightSheet() {
			return input.lens() === 'world' ? {
				heightMeters: shell.heightMeters,
				ticks: shell.heightTicks,
				pins: shell.heightPins,
				snapIncrement: shell.heightSnapIncrement,
				reducedMotion: shell.reducedMotion,
				side: shell.heightSheetSide,
				drawing: shell.task?.kind === 'layout-ink',
				onSetHeight: shell.setHeight,
				onAddPin: shell.addHeightPin,
				onActiveChange: shell.setHeightPlaneActive,
				onResetSubscribe: (onReset: () => void) => input.heightSheet.subscribeReset('height-sheet-control', onReset)
			} : null;
		},
		get lookThrough() { return input.lookThrough(); },
		get notice() { return input.lens() !== 'experience' ? shell.notice : ''; },
		get stageCursor() { return input.cursor(); },
		get styleCursor() { return stageInput.stageCursor; },
		get paperVisible() { return input.paperVisible(); },
		input: input.viewportInput,
		onLaneWidth: shell.setSheetLaneWidth,
		onActivateDisclosure: activateDisclosure
	});

	const toolbars = contribution<'core', 'toolbars'>()({
		get show() { return input.show(); },
		get world() { return input.worldToolbar(); },
		get instrument() { return input.instrument(); },
		onLowerColumnHeight: shell.setLowerColumnHeight
	});

	const panels = contribution<'core', 'panels'>()({
		get index() { return input.index(); },
		get card() { return input.card(); },
		get inactiveTask() { return input.inactiveTask(); },
		get scrim() { return !input.previewing() && shell.narrowShell && shell.indexOpen; },
		get keysOpen() { return shell.keysOpen; },
		onCloseScrim: () => shell.setIndexOpen(false),
		onResumeTask: commands.resumeTask,
		onCloseTask: commands.closeTask,
		onCloseKeys: () => shell.setKeysOpen(false)
	});

	return { canvas, overlay, head, viewport: viewportRegion, toolbars, panels };
}
