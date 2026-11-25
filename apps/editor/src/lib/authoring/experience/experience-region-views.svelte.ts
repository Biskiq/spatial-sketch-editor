import { experienceProblems } from './experience-problems';
import type { createProjectReadyPort } from '../stage/route/project-ready-port.svelte';
import type { StageDomainRead } from '../stage/source-admission';
import type { StageAssetLeases } from '../stage/route/stage-asset-leases.svelte';
import type { ExperiencePreviewHost } from './experience-preview-host';
import type VisitorPreviewSurface from '$lib/visitor/VisitorPreviewSurface.svelte';
import type { ComponentProps } from 'svelte';
import { isAllowedShippedTextureUri } from '$lib/visitor/shipped-static-registry';
/**
 * Experience's shared-region projections.
 *
 * Experience mounts no region of its own; these are the viewport and toolbar
 * keys it contributes, read from the binding and the host. They stay values (not
 * props of a spread) so the StageCanvas prop-update path is the base one.
 */
import type { ViewportEvaluation } from '@portfolio/camera-core/viewport';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import type { RegionProps } from '../workspace/region-ownership';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import type { StageExperienceBinding } from '../stage/route/stage-experience-binding.svelte';
import type { StageShellState } from '../stage/route/stage-shell-state.svelte';
import type { ExperienceController } from './experience-controller.svelte';
import type { ExperienceToolbarView, ExperienceViewportView } from './experience-view';

type DraftingView = NonNullable<RegionProps['toolbars']['viewLine']>['drafting'];

export type ExperienceRegionViewDeps = {
	readonly binding: StageExperienceBinding;
	readonly previewActive: () => boolean;
	readonly shell: () => StageShellState;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly lookThroughActive: () => boolean;
	readonly datum: () => number;
	readonly setReading: DraftingView['onReading'];
	readonly patchDrafting: DraftingView['onPatch'];
	readonly armWorldTool: (tool: 'measure') => void;
	readonly studioWhileEditing: () => boolean;
	readonly setStudioWhileEditing: DraftingView['onStudioWhileEditing'];
	readonly liftControl: () => DraftingView['lift'];
	readonly nearWallsControl: () => DraftingView['nearWalls'];
	readonly refresh: () => void;
};

export function createExperienceRegionViews(deps: ExperienceRegionViewDeps) {
	const binding = deps.binding;
	const onLookThrough = (viewId: string) => binding.lookThroughView(viewId);
	const onResolvePendingViewWrite = () => void binding.confirmPendingViewWrite();
	const onCancelPendingViewWrite = () => binding.clearPendingViewWrite();
	const onDismissWelcome = () => binding.dismissWelcome();
	const onExperienceController = (controller: ExperienceController | null) => binding.setController(controller);
	const onPlaceView = () => binding.togglePlaceView();
	const onCapture = () => binding.capture();
	const onToggleGuide = () => binding.toggleGuide();
	return {
		get viewport(): ExperienceViewportView {
			const evaluation = deps.evaluation();
			const datum = deps.datum();
			const shell = deps.shell();
			const lookThroughActive = deps.lookThroughActive();
			const viewEdit = binding.viewEdit;
			return {
				experienceMarks: binding.lensState === 'experience' && evaluation !== null && !lookThroughActive
					? {
						evaluation,
						placementGhost: binding.placementGhost(),
						liveEdit: viewEdit,
						advanced: binding.advancedViewId !== null,
						datum,
						rig: binding.playback.status === 'idle' ? null : binding.playback.sample,
						onLookThrough,
						showMarkers: shell.showMarkers,
						showFrustums: shell.showFrustums,
						showPaths: shell.showPaths,
						showLabels: shell.showLabels,
						selectionOnly: shell.showMode === 'selection',
						onPlanePoint: binding.pathAnchorPoint,
						beginPathDragLease: binding.beginPathDragLease,
						endPathDragLease: binding.endPathDragLease
					}
					: null,
				viewEditTurn: viewEdit?.moved && !viewEdit.advanced && binding.viewEditPreview?.turn
					? binding.viewEditPreview.turn
					: null,
				pendingViewWrite: binding.pendingViewWrite,
				onResolvePendingViewWrite,
				onCancelPendingViewWrite,
				welcome: binding.lensState === 'experience' && binding.welcome && !lookThroughActive && binding.experienceTool === 'select',
				onDismissWelcome,
				onExperienceController
			};
		},
		get toolbars(): ExperienceToolbarView {
			const shell = deps.shell();
			const previewActive = deps.previewActive();
			return {
				viewLine: previewActive
					? null
					: {
						drafting: {
							drafting: shell.drafting,
							reading: shell.draftingReading,
							gridWord: shell.draftingGridWord,
							snapWord: shell.draftingSnapWord,
							onReading: deps.setReading,
							onPatch: deps.patchDrafting,
							planAppearance: shell.preferences.planAppearance,
							onPlanAppearance: (planAppearance: 'paper' | 'shaded') =>
								shell.updatePreferences({ ...shell.preferences, planAppearance }),
							measureActive: shell.activeWorldTool === 'measure',
							onMeasure: () => deps.armWorldTool('measure'),
							studioWhileEditing: deps.studioWhileEditing(),
							onStudioWhileEditing: deps.setStudioWhileEditing,
							roomLabels2d: shell.preferences.roomLabels2d,
							roomLabels3d: shell.preferences.roomLabels3d,
							paperTone2d: shell.preferences.paperTone2d,
							paperTone3d: shell.preferences.paperTone3d,
							onViewPreference: (patch) => {
								shell.updatePreferences({ ...shell.preferences, ...patch });
								deps.refresh();
							},
							heightSheetSide: shell.heightSheetSide,
							onHeightSheetSide: (side: 'left' | 'right') => shell.setHeightSheetSide(side),
							reducedMotion: shell.reducedMotion,
							onToggleReducedMotion: () => shell.toggleReducedMotion(),
							motionSpeed: shell.preferences.motionSpeed,
							onMotionSpeed: (motionSpeed) => shell.updatePreferences({ ...shell.preferences, motionSpeed }),
							lift: deps.liftControl(),
							nearWalls: deps.nearWallsControl()
						}
					},
				experience: previewActive || binding.active === null
					? null
					: {
						dock: {
							captureDisabled: binding.captureReason() !== undefined,
							captureReason: binding.captureReason(),
							guideOpen: binding.guideOpen,
							placeArmed: binding.experienceTool === 'place',
							onPlaceView,
							onCapture,
							onToggleGuide
						},
						feedback: shell.notice || binding.feedback !== null
							? {
								text: shell.notice || binding.feedback!.text,
								kind: shell.notice ? null : binding.feedback!.kind
							}
							: null,
						guide: binding.guideOpen ? { onClose: onToggleGuide, playback: binding.playback } : null
					}
			};
		}
	};
}

/**
 * The homes payload, owned by Experience.
 *
 * The host passes its own services and envelope reads, so those dependencies
 * stay in the host's template effect. Taking them from inside the viewport
 * getter made the region that mounts the Canvas depend on the adapter state it
 * publishes, and the region re-rendered itself.
 */
export function experienceHomesView(
	binding: StageExperienceBinding,
	services: StageAdapterServices | null,
	envelope: ProjectEnvelope | null
): { readonly services: StageAdapterServices; readonly snapshot: ProjectEnvelope } | null {
	return binding.lensState === 'experience' && services !== null && envelope !== null
		? { services, snapshot: envelope }
		: null;
}

export type ExperienceRegionViews = ReturnType<typeof createExperienceRegionViews>;


/** The retained visitor surface reads its frozen entry and the live display options. */
export function createExperiencePreviewView(input: {
	readonly preview: ExperiencePreviewHost;
	readonly assets: Pick<StageAssetLeases, 'urls' | 'textureScope'>;
	readonly look: { readonly reducedMotion: () => boolean; readonly sky: () => ComponentProps<typeof VisitorPreviewSurface>['sky'] };
}) {
	const view = $derived.by(() => {
		const { preview, assets, look } = input;
		if (preview.surface === null || preview.viewRead === null) return null;
		const entry = preview.view?.entry ?? null;
		const read = preview.viewRead as StageDomainRead;
		return {
			surface: preview.surface,
			props: {
				geometry: read.geometry,
				scene: read.scene,
				graph: read.graph,
				program: entry === null ? null : entry.kind === 'presentations' ? (entry.program ?? null) : entry.program,
				experienceOptions: entry === null ? null : entry.kind === 'presentations' ? (entry.options ?? null) : entry.options,
				entryPresentationId: entry?.kind === 'program' ? entry.entryPresentationId : null,
				runEpoch: preview.view?.epoch ?? 0,
				active: preview.openState,
				resolveTexture: (uri: string) => isAllowedShippedTextureUri(uri) ? uri : null,
				modelUrls: assets.urls,
				textureScope: assets.textureScope,
				artworkScope: preview.artworkScope,
				reducedMotion: look.reducedMotion(),
				title: entry?.title ?? null,
				experienceTitle: entry?.title ?? null,
				startMode: preview.requestedMode ?? (entry?.kind === 'program' && entry.entryPresentationId !== null ? 'presentation' : 'welcome'),
				guideStopCount: preview.stats.stops,
				guideSeconds: preview.stats.seconds,
				viewLabels: preview.labels,
				onExit: preview.close,
				sky: look.sky()
			},
			active: preview.openState
		};
	});
	return () => view;
}


export function createExperienceSourceViews(
	ready: ReturnType<typeof createProjectReadyPort>,
	binding: StageExperienceBinding,
	services: () => StageAdapterServices | null
) {
	const problems = $derived.by(() => {
		const envelope = ready.envelope();
		return envelope === null ? [] : experienceProblems(envelope, ready.snapshot()?.domain.diagnostics ?? []);
	});
	const homes = $derived(experienceHomesView(binding, services(), ready.envelope()));
	return {
		get problems() { return problems; },
		get homes() { return homes; }
	};
}
