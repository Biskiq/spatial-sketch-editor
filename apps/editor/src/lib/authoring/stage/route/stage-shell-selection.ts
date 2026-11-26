import { planFragmentOf } from '@portfolio/layout-core/world';
import { planSourceKindOf } from './plan-source-kind';
import type { StageSourceHit } from '../stage-facade';
import type { StageSelection } from '../stage-session';
import { primaryEntry, sameReference, type StageSelectionEntry } from '../semantic-selection';
import type { WorldToolId } from '$lib/authoring/world-toolbar/registry';
import type { StageShellCommandInput } from './stage-shell-commands';

type SelectionInput = Pick<
	StageShellCommandInput,
	| 'facade'
	| 'planView'
	| 'shell'
	| 'selection'
	| 'setSelection'
	| 'clearExperienceFocus'
	| 'experience'
> & {
	readonly armWorldTool: (id: WorldToolId) => void;
};

export function createStageShellSelection(input: SelectionInput) {
	const shell = input.shell;

	/**
	 * Mirror a selection the host or an adapter made canonically.
	 *
	 * A contributed task may select a new subject after its own accepted install.
	 * A new primary selection replaces the Experience subject (one Card
	 * selection); a revision-only requalification of the same subject leaves the
	 * current Card selection alone.
	 */
	function syncPrimarySelection(next: StageSelectionEntry | null): void {
		const pick = shell.stagePickPresentationId;
		if (
			pick !== null &&
			next !== null &&
			next.reference.domain === 'scene' &&
			next.reference.subject.kind === 'entity'
		) {
			shell.setStagePickPresentationId(null);
			input.setSelection(null);
			shell.setCardOpen(true);
			void input.experience
				.active()
				?.linkPresentation(pick, next.reference.subject.id)
				.then((accepted) => {
					if (accepted) {
						input.experience.lens.selectSubject({
							kind: 'presentation',
							presentationId: pick,
						});
					}
				});
			return;
		}

		const keyOf = (entry: StageSelectionEntry | null) =>
			entry === null
				? ''
				: `${entry.reference.domain}\u0000${entry.reference.subject.kind}\u0000${entry.reference.subject.id}`;
		const previous = keyOf(input.selection());
		const key = keyOf(next);
		input.setSelection(next);
		if (key !== '' && key !== previous) {
			input.clearExperienceFocus();
			shell.setCardOpen(true);
		}
	}

	function selectHit(hit: StageSourceHit): void {
		const stage = input.facade();
		if (stage === null) return;
		const pick = shell.stagePickPresentationId;
		if (
			pick !== null &&
			hit.reference !== undefined &&
			hit.reference.domain === 'scene' &&
			hit.reference.subject.kind === 'entity'
		) {
			shell.setStagePickPresentationId(null);
			input.setSelection(null);
			shell.setCardOpen(true);
			void input.experience.active()?.linkPresentation(pick, hit.reference.subject.id);
			return;
		}
		const planKind = hit.reference === undefined ? planSourceKindOf(hit.sourceKind) : null;
		// A Room lid is a Paint-only hit: selection stays on the Plan floor.
		if (hit.reference === undefined && planKind === null) return;
		if (hit.reference !== undefined) {
			stage.setSelection({ ordered: [{ reference: hit.reference }], primary: hit.reference });
			input.setSelection(primaryEntry(stage.selectionState()));
			input.clearExperienceFocus();
			shell.setCardOpen(true);
			return;
		}
		const selected: StageSelection = {
			sourceId: hit.sourceId,
			sourceKind: planKind!,
			generationId: hit.generationId,
			ref: {
				sourceId: hit.sourceId,
				sourceKind: planKind!,
				generationId: hit.generationId,
				stream: hit.stream,
				subRef: hit.subRef,
			},
		};
		stage.select(selected);
		input.setSelection(primaryEntry(stage.selectionState()));
		input.clearExperienceFocus();
		shell.setCardOpen(true);
	}

	function selectUnfoldedSubject(wallId: string, openingId: string | null): void {
		const stage = input.facade();
		if (stage === null) return;
		const sourceId = openingId ?? wallId;
		// Use the snapshot's resolved subject reference, exactly as `selectSource`.
		const subject = stage.subjects().find((candidate) => candidate.id === sourceId);
		if (subject !== undefined) {
			const change = stage.setSelection({
				ordered: [{ reference: subject.reference }],
				primary: subject.reference,
			});
			if (change.kind === 'selected') {
				input.setSelection(primaryEntry(stage.selectionState()));
				input.clearExperienceFocus();
				shell.setCardOpen(true);
				return;
			}
		}
		// A compiled Wall/Opening can be present in the Plan while its resolved
		// subject is not contributed to the Index; the Plan fragment is the fallback.
		const plan = input.planView();
		const fragment = plan === null ? undefined : planFragmentOf(plan, sourceId);
		if (fragment === undefined) return;
		stage.select({
			sourceId: fragment.ref.sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref,
		});
		input.setSelection(primaryEntry(stage.selectionState()));
		input.clearExperienceFocus();
		shell.setCardOpen(true);
	}

	function selectSource(sourceId: string): void {
		const stage = input.facade();
		const plan = input.planView();
		if (stage === null || plan === null) return;
		shell.setCardOpen(true);
		const subject = stage.subjects().find((item) => item.id === sourceId);
		if (subject !== undefined) {
			stage.setSelection({
				ordered: [{ reference: subject.reference }],
				primary: subject.reference,
			});
			input.setSelection(primaryEntry(stage.selectionState()));
			input.clearExperienceFocus();
			return;
		}
		const layoutId = sourceId.startsWith('layout:')
			? sourceId.slice(sourceId.indexOf(':', 7) + 1)
			: sourceId;
		const fragment = planFragmentOf(plan, layoutId);
		if (fragment === undefined) return;
		stage.select({
			sourceId: layoutId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref,
		});
		input.setSelection(primaryEntry(stage.selectionState()));
		input.clearExperienceFocus();
	}

	/** Stage-select a subject from an Experience Card link. */
	function selectStageReference(reference: StageSelectionEntry['reference']): void {
		const stage = input.facade();
		if (stage === null) return;
		const change = stage.setSelection({ ordered: [{ reference }], primary: reference });
		if (change.kind === 'refused') return;
		input.setSelection(primaryEntry(stage.selectionState()));
		input.clearExperienceFocus();
		shell.setCardOpen(true);
	}

	/** Clearing the selection does reopen the Card for the next subject. */
	function closeSelection(): void {
		input.facade()?.select(null);
		input.setSelection(null);
		input.clearExperienceFocus();
		shell.setCardOpen(true);
	}

	/** The Card is an overlay: hiding it is not a selection change. */
	function openSpaceCreated(reference: Parameters<typeof sameReference>[0]): void {
		const stage = input.facade();
		if (stage === null) return;
		const selected = primaryEntry(stage.selectionState());
		if (selected === null || !sameReference(selected.reference, reference)) return;
		input.armWorldTool('select');
		syncPrimarySelection(selected);
		shell.requestCardRename(reference);
	}

	function closeCard(): void {
		shell.setCardOpen(false);
	}

	return {
		syncPrimarySelection,
		selectHit,
		selectUnfoldedSubject,
		selectSource,
		selectStageReference,
		closeSelection,
		openSpaceCreated,
		closeCard,
	};
}
