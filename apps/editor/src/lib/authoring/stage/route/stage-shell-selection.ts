import { planFragmentOf } from '@portfolio/layout-core/world';
import { planSourceKindOf } from './plan-source-kind';
import type { StageSourceHit } from '../stage-facade';
import type { StageSelection } from '../stage-session';
import { primaryEntry, sameReference, type StageSelectionEntry } from '../semantic-selection';
import type { SemanticReference } from '@portfolio/project-model/references';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import {
	sceneGroupOfSelection,
	sceneSelectionTargetForHit,
	topLevelSceneReference,
} from '$lib/authoring/scene/selection-target';
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
	/** Coarse-pointer Select more: an unmodified tap toggles instead of replacing. */
	readonly selectMore: () => boolean;
	readonly setSelectMore: (value: boolean) => void;
};

/** The modifier state a Stage tap or Index row carries. */
export type SelectionTap = {
	readonly additive?: boolean;
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

	/**
	 * Write one canonical selection: a single subject replaces, an additive tap
	 * toggles its **top-level** target in the set. Nothing is written when the
	 * owner refuses the identity.
	 */
	function applySelection(reference: SemanticReference, tap: SelectionTap = {}): boolean {
		const stage = input.facade();
		if (stage === null) return false;
		const additive = tap.additive === true || input.selectMore();
		const previous = stage.selectionState();
		const ordered = previous.ordered.map((entry) => entry.reference);
		if (!additive) {
			const change = stage.setSelection({ ordered: [{ reference }], primary: reference });
			if (change.kind === 'refused') return false;
			input.setSelection(primaryEntry(stage.selectionState()));
			input.setSelectMore(false);
			input.clearExperienceFocus();
			shell.setCardOpen(true);
			return true;
		}
		const present = ordered.some((entry) => sameReference(entry, reference));
		const next = present
			? ordered.filter((entry) => !sameReference(entry, reference))
			: [...ordered, reference];
		if (next.length === 0) {
			stage.select(null);
			input.setSelection(null);
			input.clearExperienceFocus();
			shell.setCardOpen(true);
			return true;
		}
		const change = stage.setSelection({
			ordered: next.map((entry) => ({ reference: entry })),
			// A set has no primary; a one-entry selection is its own primary.
			primary: next.length === 1 ? next[0]! : null,
		});
		if (change.kind === 'refused') return false;
		input.setSelection(primaryEntry(stage.selectionState()));
		input.clearExperienceFocus();
		shell.setCardOpen(true);
		return true;
	}

	/** The reference a Scene hit addresses: group-first, then the drilled member. */
	function hitReference(hit: StageSourceHit, tap: SelectionTap): SemanticReference | null {
		if (hit.reference === undefined) return null;
		if (hit.reference.domain !== 'scene' || hit.reference.subject.kind !== 'entity')
			return hit.reference;
		const stage = input.facade();
		if (stage === null) return hit.reference;
		const scene = stageScene(stage.snapshot());
		return sceneSelectionTargetForHit({
			scene,
			entityId: hit.reference.subject.id,
			contentRevision:
				hit.reference.revision.kind === 'exact' ? hit.reference.revision.contentRevision : '',
			selected: stage.selectionState().ordered.map((entry) => entry.reference),
			additive: tap.additive === true || input.selectMore(),
		});
	}

	function selectHit(hit: StageSourceHit, tap: SelectionTap = {}): void {
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
			const reference = hitReference(hit, tap);
			if (reference !== null) applySelection(reference, tap);
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

	function selectSource(sourceId: string, tap: SelectionTap = {}): void {
		const stage = input.facade();
		const plan = input.planView();
		if (stage === null || plan === null) return;
		shell.setCardOpen(true);
		const subject = stage.subjects().find((item) => item.id === sourceId);
		if (subject !== undefined) {
			if (subject.reference.domain === 'scene') {
				applySelection(
					topLevelSceneReference(stageScene(stage.snapshot()), subject.reference),
					tap,
				);
				return;
			}
			applySelection(subject.reference, tap);
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

	/**
	 * Escape's member → group rung: a single drilled member returns to the group
	 * that owns it. `null` leaves the rung to the next Escape handler.
	 */
	function drillOutOfGroup(): boolean {
		const stage = input.facade();
		if (stage === null) return false;
		const reference = sceneGroupOfSelection(
			stageScene(stage.snapshot()),
			stage.selectionState().ordered.map((entry) => entry.reference),
		);
		if (reference === null) return false;
		const change = stage.setSelection({ ordered: [{ reference }], primary: reference });
		if (change.kind === 'refused') return false;
		input.setSelection(primaryEntry(stage.selectionState()));
		shell.setCardOpen(true);
		return true;
	}

	/** The group Card's member row: select one member inside its group (a drill). */
	function selectMember(entityId: string): void {
		const stage = input.facade();
		if (stage === null) return;
		const scene = stageScene(stage.snapshot());
		const entity = scene.entities.find((entry) => entry.id === entityId);
		if (entity === undefined) return;
		const revision = stage.snapshot().domain.unitRevisions.scene;
		applySelection({
			version: 1,
			domain: 'scene',
			revision: { kind: 'exact', contentRevision: revision },
			subject: { kind: 'entity', id: entityId },
			instancePath: [],
			location: { kind: 'project-root' },
			componentId: null,
			capabilityId: null,
		});
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
		applySelection,
		drillOutOfGroup,
		selectMember,
		closeSelection,
		openSpaceCreated,
		closeCard,
	};
}
