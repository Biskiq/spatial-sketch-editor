import { acceptedSceneRoomMembership } from '../../adapters/scene/room-membership';
import { sameReference, type StageSelectionEntry } from '../semantic-selection';
import type { StageFacade } from '../stage-facade';
import type { createProjectReadyPort } from './project-ready-port.svelte';
import { createStageSelectionView } from './stage-selection-view';
import type { StageShellState } from './stage-shell-state.svelte';
import type { createStageViewport } from './stage-viewport.svelte';

/** The readout may hide the Stage primary while Experience resolves a link pick. */
export function createStageSelectionPresentation() {
	let selection = $state<StageSelectionEntry | null>(null);
	return {
		get: () => selection,
		set: (entry: StageSelectionEntry | null) => {
			selection = entry;
		},
		clear(stage: StageFacade | null) {
			stage?.select(null);
			selection = null;
		},
	};
}

export function createStageSelectionReadout(input: {
	readonly ready: ReturnType<typeof createProjectReadyPort>;
	readonly envelope: ReturnType<typeof createProjectReadyPort>['envelope'];
	readonly facade: () => StageFacade | null;
	readonly selection: () => StageSelectionEntry | null;
	readonly viewport: Pick<ReturnType<typeof createStageViewport>, 'planView'>;
	readonly shell: Pick<StageShellState, 'worldScope' | 'contributionsVersion'>;
	readonly studioActive: () => boolean;
}) {
	const selectionView = createStageSelectionView();
	const sceneRooms = $derived.by(() => {
		const envelope = input.envelope();
		return envelope === null ? new Map<string, string>() : acceptedSceneRoomMembership(envelope);
	});
	const subjects = $derived.by(() => {
		void input.shell.contributionsVersion;
		return input.facade()?.subjects() ?? [];
	});
	const selectionSet = $derived.by(() => {
		void input.shell.contributionsVersion;
		return input.facade()?.selectionState().ordered ?? [];
	});
	const readout = $derived(
		selectionView.read({
			snapshot: input.ready.snapshot(),
			envelope: input.envelope(),
			sceneRooms,
			selection: input.selection(),
			selectionSet,
			planView: input.studioActive() ? null : input.viewport.planView,
			subjects,
			scope: input.shell.worldScope,
		}),
	);
	return () => readout;
}

export function installStageCardRenameGuard(input: {
	readonly facade: () => StageFacade | null;
	readonly selection: () => StageSelectionEntry | null;
	readonly shell: Pick<
		StageShellState,
		'cardRenameTarget' | 'cardRenameRequest' | 'consumeCardRename'
	>;
}): void {
	$effect(() => {
		const target = input.shell.cardRenameTarget;
		const primary = input.facade()?.selectionState().primary;
		if (!target) return;
		if (primary != null && sameReference(primary, target)) {
			const selection = input.selection();
			if (selection === null || sameReference(selection.reference, target)) return;
		}
		input.shell.consumeCardRename(input.shell.cardRenameRequest);
	});
}
