import type { StageSelectionView } from './stage-selection-view';
import type { StageShellState } from './stage-shell-state.svelte';
import type { StageCardActionRecord, StageFacade } from '../stage-facade';
import { sceneClusterOf, sceneClusterReference } from '$lib/authoring/scene/selection-target';
import type { SemanticReference } from '@portfolio/project-model/references';

export function memberGroupLink(
	view: StageSelectionView,
	select: (reference: SemanticReference) => void,
) {
	const subject = view.cardSubject?.reference;
	if (
		view.scenePayload === null ||
		subject?.domain !== 'scene' ||
		subject.subject.kind !== 'entity' ||
		subject.revision.kind !== 'exact'
	)
		return null;
	const group = sceneClusterOf(view.scenePayload, subject.subject.id);
	if (group === null) return null;
	const reference = sceneClusterReference(group.id, subject.revision.contentRevision);
	return { label: group.name, onOpen: () => select(reference) };
}

export function selectMoreActions(shell: StageShellState): readonly StageCardActionRecord[] {
	if (typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches) return [];
	return [
		{
			id: 'selection-select-more',
			label: shell.selectMore ? 'Done selecting' : '＋ Select more',
			adapterId: 'host',
			inline: true,
			async run() {
				shell.setSelectMore(!shell.selectMore);
				return { kind: 'accepted' };
			},
		},
	];
}

export function selectionSetActions(
	stage: StageFacade | null,
	shell: StageShellState,
	clear: () => void,
): readonly StageCardActionRecord[] {
	return [
		...(stage?.setActions() ?? []),
		{
			id: 'selection-clear',
			label: 'Clear',
			adapterId: 'host',
			inline: true,
			async run() {
				clear();
				return { kind: 'accepted' };
			},
		},
		...selectMoreActions(shell),
	];
}
