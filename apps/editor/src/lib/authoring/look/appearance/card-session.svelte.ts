import { untrack } from 'svelte';
import { withFinishInstancePreview } from '@portfolio/project-model/scene-planning';
import type { StageReadSnapshot } from '../../stage/accepted-read';
import type { StageSelectionEntry } from '../../stage/semantic-selection';
import type { StageFinishCardPort } from '../../stage/stage-adapter-host';
import type { FinishAuthoring } from '../finish-authoring.svelte';

export function createCardSession(input: {
	readonly selection: () => StageSelectionEntry | null;
	readonly finishes: () => FinishAuthoring;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly draftPreview: () => ReturnType<FinishAuthoring['libraryDraftPreview']>;
}) {
	let finishCardSelectionKey = '';
	$effect(() => {
		const entry = input.selection();
		const key =
			entry === null
				? ''
				: `${entry.reference.domain}\u0000${entry.reference.subject.kind}\u0000${entry.reference.subject.id}`;
		if (key === finishCardSelectionKey) return;
		finishCardSelectionKey = key;
		// A selection change discards a Card gesture: nothing is written. The
		// material Editor and the image/repair pickers it opened belong to the old
		// target and close by their cancel paths; Align follows the
		// Card's open user below.
		untrack(() => {
			input.finishes().card.cancel();
			if (input.finishes().editor.open) input.finishes().editor.close(false);
			input.finishes().cancelImage();
			input.finishes().issues.cancelRepairs();
		});
	});

	function cancelGesture(): boolean {
		return input.finishes().card.cancel();
	}

	/** The lifecycle form: a step never refuses because there is no gesture. */
	function cancelCardGesture(): void {
		input.finishes().card.cancel();
	}

	// Keep the admitted source's fallback and the precedence of draft and Card preview.
	function canvasKeys(snapshot: StageReadSnapshot) {
		return {
			get scene() {
				const accepted = input.snapshot()?.domain.scene;
				return accepted === undefined
					? snapshot.domain.scene
					: withFinishInstancePreview(
							accepted,
							input.draftPreview() ?? input.finishes().card.preview,
						);
			},
			get proposals() {
				return input.finishes().card.proposalEntries();
			},
		};
	}

	return {
		cancelGesture,
		cancelCardGesture,
		canvasKeys,
		adapter: (): StageFinishCardPort => input.finishes(),
	};
}
