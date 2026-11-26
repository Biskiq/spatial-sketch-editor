import type { ScenePickSource } from '../scene/scene-pick-source';
import { contribution } from '../workspace/region-ownership';
import type {
	StageArtworkInteraction,
	StageArtworkInteractionInput,
} from '../stage/route/stage-artwork-interaction.svelte';
import type { ResolvedSlice } from '../stage/slice/slice-cut';
import { pickVisibleFaceThroughSlice } from '../stage/slice/stage-slice-pick';
import type { StageLens } from '../stage/stage-session';
import { activeArtworkHangGuide, artworkHangingGuides } from './artwork-hanging';
import type { ArtworkOverlay, ArtworkScope, HangingOverlay } from './artwork-view';

export type ArtworkDependencies = {
	readonly interaction: Omit<StageArtworkInteractionInput, 'canEdit' | 'pickVisibleFace'>;
	readonly ready: () => boolean;
	readonly lens: () => StageLens;
	readonly previewing: () => boolean;
	readonly unfoldActive: () => boolean;
	readonly resolvedSlice: () => ResolvedSlice | null;
	readonly scenePick: ScenePickSource;
	readonly artworkScope: () => ArtworkScope;
};

export function createArtworkHost(input: ArtworkDependencies) {
	function canPlace(): boolean {
		return input.lens() === 'world' && !input.previewing() && !input.unfoldActive();
	}

	function connect(interaction: StageArtworkInteraction) {
		const selected = $derived.by(input.interaction.selected);
		const candidate = $derived(interaction.hangingCandidate);
		const guides = $derived.by(() => {
			const stage = input.interaction.facade();
			if (stage === null || candidate === null) return [];
			const snapshot = stage.snapshot();
			return artworkHangingGuides(snapshot.domain.scene, candidate, snapshot.domain.datumMeters);
		});
		const activeGuideId = $derived(
			candidate === null ? null : activeArtworkHangGuide(guides, candidate.position[1]),
		);

		function cancel(): void {
			interaction.cancel();
		}

		function cancelAll(): void {
			interaction.cancel();
			interaction.cancelResize();
		}

		$effect(() => {
			if (!input.ready()) cancel();
			if (!canPlace()) cancelAll();
		});

		function dragOver(event: DragEvent): void {
			if (interaction.acceptsDrop(event.dataTransfer)) event.preventDefault();
		}

		const canvas = contribution<'artwork', 'canvas'>()({
			get artworkScope() {
				return input.artworkScope();
			},
			get artworkGhost() {
				return interaction.resizeGhost ?? interaction.ghost;
			},
			onArtworkError: input.interaction.onNotice,
		});
		const overlay = contribution<'artwork', 'overlay'>()({
			get candidates() {
				return interaction.placementCandidate === null ? [] : [interaction.placementCandidate];
			},
		});
		const viewport = contribution<'artwork', 'viewport'>()({
			get hanging(): HangingOverlay {
				const stage = input.interaction.facade();
				const evaluation = input.interaction.evaluation();
				return stage !== null && evaluation?.renderedReading === '3d' && guides.length > 0
					? { stage, evaluation, guides, activeGuideId }
					: null;
			},
			get artwork(): ArtworkOverlay {
				const stage = input.interaction.facade();
				const evaluation = input.interaction.evaluation();
				if (
					selected === null ||
					stage === null ||
					evaluation?.renderedReading !== '3d' ||
					!canPlace() ||
					interaction.armed
				)
					return null;
				return {
					entity: interaction.resizeGhost ?? selected,
					stage,
					evaluation,
					resizing: interaction.resizeGhost !== null,
					blocked: interaction.resizeBlocked,
					canTurn: !interaction.isHungNow(selected),
					onStart: interaction.startResize,
				};
			},
		});

		return { cancel, cancelAll, dragOver, canvas, overlay, viewport };
	}

	return {
		canPlace,
		// Artwork hangs on a drawn face, including the Wall behind a removed one.
		pickVisibleFace: pickVisibleFaceThroughSlice(input.scenePick, input.resolvedSlice),
		connect,
	};
}
