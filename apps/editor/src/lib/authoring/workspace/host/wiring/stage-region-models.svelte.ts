import {
	stageWorldCardView,
	type StageSelectionView,
} from '$lib/authoring/stage/route/stage-selection-view';
import type { StageShellState } from '$lib/authoring/stage/route/stage-shell-state.svelte';
import type { StageShellCommands } from '$lib/authoring/stage/route/stage-shell-commands';
import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import type { createAppearanceFeature } from '$lib/authoring/look/appearance-feature.svelte';
import type { createLayoutReadingsFeature } from '$lib/authoring/stage/readings/layout-readings-feature.svelte';
import type { createSkyFeature } from '$lib/authoring/look/sky-feature.svelte';
import type { createArtworkFeature } from '$lib/authoring/artwork/artwork-feature.svelte';
import type { createStudioFeature } from '$lib/authoring/studio/studio-feature.svelte';
import type { createExperienceFeature } from '$lib/authoring/experience/experience-feature.svelte';
import type { createLibraryFeature } from '$lib/authoring/library/library-feature.svelte';
import type {
	stageContributedInstrument,
	stageInactiveTask,
	stageTaskHost,
} from '$lib/authoring/stage/route/stage-contribution-view';
import type { RegionProps } from '$lib/authoring/workspace/region-ownership';
import { sameReference } from '$lib/authoring/stage/semantic-selection';

type StageRegionInput = {
	readonly previewing: () => boolean;
	readonly shell: StageShellState;
	readonly commands: StageShellCommands;
	readonly experience: ReturnType<typeof createExperienceFeature>['ports']['binding'];
	readonly experienceFeature: ReturnType<typeof createExperienceFeature>;
	readonly studioFeature: ReturnType<typeof createStudioFeature>;
	readonly appearance: ReturnType<typeof createAppearanceFeature>;
	readonly readings: ReturnType<typeof createLayoutReadingsFeature>;
	readonly sky: ReturnType<typeof createSkyFeature>;
	readonly artwork: ReturnType<typeof createArtworkFeature>;
	readonly library: ReturnType<typeof createLibraryFeature>;
	readonly selectionViewView: () => StageSelectionView;
	readonly selection: () => StageSelectionEntry | null;
	readonly contributedInstrument: () => ReturnType<typeof stageContributedInstrument>;
	readonly taskHost: () => ReturnType<typeof stageTaskHost>;
	readonly inactiveTask: () => ReturnType<typeof stageInactiveTask>;
	readonly facade: () => StageFacade | null;
	readonly bringIntoView: (target: [number, number, number]) => void;
	readonly lookThroughActive: () => boolean;
	readonly toggleReveal: (sourceId: string) => void;
};

/**
 * Builds the toolbar, panel and Card projections. Each getter reads the owner
 * that supplies the value, so the host never carries the region shape itself.
 */
export function createStageRegionModels(input: StageRegionInput) {
	const studio = input.studioFeature.controller;
	const finishes = input.appearance.ports.finishes();
	const lookCardStratum = $derived.by(() => {
		void input.shell.contributionsVersion;
		const subject = input.selectionViewView().cardSubject;
		const entity =
			subject?.reference?.domain === 'scene'
				? input
						.selectionViewView()
						.scenePayload?.entities.find((entry) => entry.id === subject.sourceId)
				: undefined;
		return (
			(entity?.kind === 'artwork' ? input.artwork.ports.card(entity) : null) ??
			input.sky.ports.cardStratum(subject)
		);
	});
	const worldCard = $derived(
		stageWorldCardView({
			facade: input.facade(),
			subject: input.selectionViewView().cardSubject,
			datumMeters: input.experienceFeature.ports.floorDatum,
			look: lookCardStratum,
			revision: input.shell.contributionsVersion,
		}),
	);
	const shownCard = $derived.by(() => {
		if (input.experience.lensState === 'experience') return input.experienceFeature.ports.shownCard;
		const identity = input.selectionViewView().cardIdentity;
		// A set has no primary subject: its Card lists the identities and offers
		// only what a set can do as a whole (Group, Light it, Clear).
		if (input.selectionViewView().isSelectionSet) {
			void input.shell.contributionsVersion;
			const more = coarsePointer()
				? [
						{
							id: 'selection-select-more',
							label: input.shell.selectMore ? 'Done selecting' : '＋ Select more',
							adapterId: 'host',
							run: async () => {
								input.shell.setSelectMore(!input.shell.selectMore);
								return { kind: 'accepted' as const };
							},
						},
					]
				: [];
			return {
				identity,
				facts: [],
				nameWriter: null,
				writer: input.facade()?.setWriter() ?? null,
				actions: [...(input.facade()?.setActions() ?? []), ...more],
				functions: [],
				kindLink: null,
				menu: null,
				back: null,
				bringIntoView: () => {
					const target = input.selectionViewView().selectedWorldPoint();
					if (target !== null) input.bringIntoView(target);
				},
			};
		}
		return {
			identity,
			facts: worldCard.facts,
			nameWriter: worldCard.nameWriter,
			writer: worldCard.writer,
			// Studio offers only what it owns: no World functions (Paint, Section, Present),
			// no Look recipes; the facade withholds Duplicate/Delete of the root being edited.
			actions: worldCard.actions,
			functions: studio.active ? [] : null,
			kindLink: null,
			menu: null,
			back: null,
			bringIntoView: () => {
				const target = input.selectionViewView().selectedWorldPoint();
				if (target !== null) input.bringIntoView(target);
			},
		};
	});

	/** Coarse pointers get the Card's own Select more control. */
	function coarsePointer(): boolean {
		return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
	}

	function artworkShelf() {
		const scene = input.selectionViewView().scenePayload;
		return scene === null ? null : (scene.artworkLibrary ?? []);
	}

	const showRegion = $derived.by((): RegionProps['toolbars']['show'] =>
		!input.previewing() && input.experience.lensState === 'experience'
			? {
					open: input.shell.showOpen,
					mode: input.shell.showMode,
					markers: input.shell.showMarkers,
					frustums: input.shell.showFrustums,
					paths: input.shell.showPaths,
					labels: input.shell.showLabels,
					offCount: input.shell.showOffCount,
					hidden: input.lookThroughActive(),
					onToggle: () => input.shell.setShowOpen(!input.shell.showOpen),
					onClose: () => input.shell.setShowOpen(false),
					onMode: (mode) => input.shell.setShowMode(mode),
					onMarkers: (value) => input.shell.setShowMarkers(value),
					onFrustums: (value) => input.shell.setShowFrustums(value),
					onPaths: (value) => input.shell.setShowPaths(value),
					onLabels: (value) => input.shell.setShowLabels(value),
					onShowAll: () => input.shell.showAll(),
				}
			: null,
	);
	const worldRegion = $derived.by((): RegionProps['toolbars']['world'] =>
		!input.previewing() && input.experience.lensState === 'world'
			? {
					studio: studio.active,
					activeTool: input.shell.activeWorldTool,
					libraryOpen: input.shell.libraryOpen,
					plateOpen: input.shell.worldPlateOpen,
					requestedCategory: input.shell.libraryCategoryRequest,
					onPlateOpen: (open: boolean) => input.shell.setWorldPlateOpen(open),
					onTool: (id) => input.commands.armWorldTool(id),
					onLibrary: () =>
						input.shell.libraryOpen
							? input.library.ports.close()
							: input.commands.toggleWorldLibrary('dock'),
					furnishOpen: input.shell.furnishStripOpen,
					onFurnish: () => input.commands.toggleFurnishStrip(),
					onFurnishBrowse: () => input.commands.browseFurnish(),
					onObjectPick: (assetId: string) => input.commands.pickWorldObject(assetId),
					onMaterialPick: input.sky.ports.pickMaterial,
					finishShelf: input.appearance.regions.finishShelf,
					onFinishPick: (ref) => {
						// Library opened from the Paint tray: a pick arms Paint and hands back to the tray.
						const fromPaint = input.shell.armedHostTool === 'paint';
						void finishes.pickFinish(ref);
						if (fromPaint && input.shell.libraryOpen) input.commands.armWorldTool('paint');
					},
					finishTileSource: input.appearance.ports.finishTileSource,
					finishImage: finishes.image,
					onFinishImageImport: (file: File) => void finishes.addFromImage(file),
					onFinishImageCancel: () => finishes.cancelImage(),
					onFinishImageRetry: () => void finishes.retryImageUpload(),
					onFinishImageReset: () => finishes.resetImage(),
					lookShelf: input.sky.libraryShelf,
					artworkShelf: artworkShelf(),
					onArtworkPick: (entry) => {
						input.commands.selectTool();
						input.artwork.ports.arm(entry);
					},
					onArtworkImport: (files: File[]) => {
						input.commands.selectTool();
						void input.artwork.ports.importFiles(files);
					},
					onLookPick: input.sky.ports.pickLibraryEntry,
					trayOwnsPlate: input.appearance.regions.ownsPaintPlate,
					paintChip: input.appearance.regions.paintChip,
					plateKind:
						input.shell.activeWorldTool === 'walls' ||
						input.shell.activeWorldTool === 'opening' ||
						input.shell.activeWorldTool === 'room' ||
						input.shell.activeWorldTool === 'terrace' ||
						input.shell.activeWorldTool === 'roofline'
							? 'ink'
							: input.shell.activeWorldTool === 'objects'
								? 'objects'
								: input.shell.activeWorldTool === 'slice'
									? 'slice'
									: null,
					inkReading: input.shell.inkReading,
					sliceMode: input.readings.sliceMode,
					sliceDrawing: input.readings.ports.sliceDraw.armed,
					onSliceLevel: input.readings.ports.levelSlice,
					onSliceDrawn: input.readings.ports.drawSlice,
					onTogglePalette: () => input.shell.togglePalette(),
				}
			: null,
	);
	const instrumentRegion = $derived.by((): RegionProps['toolbars']['instrument'] => {
		const instrument = input.contributedInstrument();
		return !input.previewing() &&
			instrument !== null &&
			(instrument.presentation !== 'palette' || input.shell.paletteOpen)
			? {
					task: input.taskHost(),
					onClose: () => input.commands.closeTask(),
					onCollapse: () => input.shell.setPaletteOpen(false),
					instrument,
				}
			: null;
	});
	const indexRegion = $derived.by((): RegionProps['panels']['index'] => ({
		open: input.shell.indexOpen,
		model: input.selectionViewView().worldIndex,
		scope: input.selectionViewView().resolvedScope,
		onScope: (scope) => input.shell.setWorldScope(scope),
		onClose: () => input.shell.setIndexOpen(false),
		selectionId: input.selectionViewView().selectedLocatorId,
		query: input.shell.query,
		onQuery: (next: string) => input.shell.setQuery(next),
		onSelect: (sourceId: string) => input.commands.selectSource(sourceId),
		onBringIntoView: (sourceId: string) => {
			const target = input.selectionViewView().sourceWorldPoint(sourceId);
			if (target !== null) input.bringIntoView(target);
		},
		onReveal: (id: string) => {
			if (id.startsWith('layout:')) input.toggleReveal(id.slice(id.indexOf(':', 7) + 1));
		},
		onRename: () => input.shell.requestCardRename(),
		experience: input.experience.index,
	}));
	const cardRegion = $derived.by((): RegionProps['panels']['card'] => ({
		identity: !input.previewing() && input.shell.cardOpen ? shownCard.identity : null,
		facts: shownCard.facts,
		nameWriter: shownCard.nameWriter,
		renameRequest:
			input.shell.cardRenameTarget === null ||
			(input.selection() !== null &&
				sameReference(input.selection()!.reference, input.shell.cardRenameTarget))
				? input.shell.cardRenameRequest
				: 0,
		onRenameRequestConsumed: input.shell.consumeCardRename,
		writer: shownCard.writer as RegionProps['panels']['card']['writer'],
		actions: shownCard.actions as RegionProps['panels']['card']['actions'],
		functions: shownCard.functions,
		kindLink: shownCard.kindLink,
		menu: shownCard.menu,
		back: shownCard.back,
		gesturing: input.shell.cardGesturing,
		onClose: () => input.commands.closeCard(),
		onBringIntoView: shownCard.bringIntoView,
		onPaint:
			shownCard.identity !== null &&
			!['wall', 'room', 'opening', 'light', 'artwork'].includes(
				shownCard.identity.kind.toLowerCase(),
			)
				? () => input.commands.armWorldTool('paint')
				: null,
	}));
	const inactiveTaskRegion = $derived.by((): RegionProps['panels']['inactiveTask'] => {
		const inactive = input.inactiveTask();
		return !input.previewing() && inactive !== null ? { label: inactive.label } : null;
	});

	return {
		get worldCard() {
			return worldCard;
		},
		get shownCard() {
			return shownCard;
		},
		get showRegion() {
			return showRegion;
		},
		get worldRegion() {
			return worldRegion;
		},
		get instrumentRegion() {
			return instrumentRegion;
		},
		get indexRegion() {
			return indexRegion;
		},
		get cardRegion() {
			return cardRegion;
		},
		get inactiveTaskRegion() {
			return inactiveTaskRegion;
		},
	};
}
