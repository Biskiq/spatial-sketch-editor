/**
 * X3 / decomposition contract S — read-only selection, Index, source-locator
 * and Card projections.
 *
 * The route used to derive these records inline from the admitted snapshot and
 * the facade. They are presentation reads: the selection, the compiled Plan,
 * the located subjects and the authored payloads stay their owners, and this
 * module only shapes what the Index, the source crumb and the one Card show.
 *
 * Nothing here writes: no selection command, no task, no acceptance, no
 * history, no renderer resource. `createStageSelectionView` owns the existing
 * `worldIndexModel` memo (one per mounted route) rather than re-creating its
 * relation index on every frame.
 */
import type { PlanEvaluation, PlanMembershipReason } from '@portfolio/layout-core';
import { planFragmentOf, planMembershipOf } from '@portfolio/layout-core';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import type { SceneArtworkEntity } from '@portfolio/project-model';
import type { StageReadSnapshot } from '../accepted-read';
import type {
	StageCardActionRecord,
	StageCardSubject,
	StageCardWriterRecord,
	StageFacade,
	StageSubject
} from '../stage-facade';
import type { StageSelectionEntry } from '../semantic-selection';
import { stageCardActions, stageCardFacts, stageCardWriter } from '../stage-contributions';
import {
	indexLabels,
	layoutKindWord,
	membershipLabel,
	sceneKindWord,
	type IndexLabel,
	type IndexLabelInput
} from '../shell/index-labels';
import {
	createWorldIndexModel,
	resolveWorldScope,
	type WorldIndexModel,
	type WorldScope
} from '../shell/world-index-model';
import { stageLayout, stageScene } from '../unit-stage-source';

/** One Index row before search: membership or a located subject. */
export type StageIndexEntry = {
	readonly group: string;
	readonly sourceId: string;
	readonly kindWord: string;
	readonly name: string | null;
	readonly eligible: boolean;
	readonly revealed: boolean;
	readonly membership: string;
};

/** The Card's identity line: authored/generated name, kind and Plan status. */
export type StageCardIdentity = {
	readonly sourceId: string;
	readonly label: string;
	readonly kind: string;
	readonly status: string;
};

/** The Card's contributed facts, name writer, field writer and scoped actions. */
export type StageWorldCardView = {
	readonly facts: readonly { readonly label: string; readonly value: string; readonly fieldId?: string }[];
	readonly nameWriter: ReturnType<StageFacade['cardNameWriter']> | null;
	readonly writer: StageCardWriterRecord | null;
	readonly actions: readonly StageCardActionRecord[];
};

/** The stable document/Index read; selection and scope never rebuild it. */
export type StageIndexProjection = {
	readonly layoutPayload: ReturnType<typeof stageLayout> | null;
	readonly scenePayload: ReturnType<typeof stageScene> | null;
	readonly entries: readonly StageIndexEntry[];
	readonly labels: ReadonlyMap<string, IndexLabel>;
	readonly entryMap: ReadonlyMap<string, StageIndexEntry>;
	readonly worldIndex: WorldIndexModel;
	readonly sceneEntityOf: (entityId: string) => ReturnType<typeof stageScene>['entities'][number] | null;
};

export type StageSelectionView = StageIndexProjection & {
	readonly selectedLocatorId: string | null;
	readonly resolvedScope: WorldScope;
	readonly locationLabel: string;
	readonly selectedMembership: PlanMembershipReason | null;
	readonly cardIdentity: StageCardIdentity | null;
	readonly cardSubject: StageCardSubject | null;
	readonly selectedArtwork: SceneArtworkEntity | null;
	readonly referenceLabel: (reference: StageSelectionEntry['reference']) => string | null;
	readonly selectedWorldPoint: () => [number, number, number] | null;
	readonly sourceWorldPoint: (sourceId: string) => [number, number, number] | null;
};

export type StageSelectionViewInput = {
	/** The admitted source, or null before boot/admission. */
	readonly snapshot: StageReadSnapshot | null;
	/** The accepted envelope, already read by the route for its other owners. */
	readonly envelope: ProjectEnvelope | null;
	/** Accepted Scene→Room membership, read once by the route from the envelope. */
	readonly sceneRooms: ReadonlyMap<string, string>;
	readonly selection: StageSelectionEntry | null;
	readonly planView: PlanEvaluation | null;
	readonly subjects: readonly StageSubject[];
	readonly scope: WorldScope;
};

export type StageWorldCardInput = {
	readonly facade: StageFacade | null;
	readonly subject: StageCardSubject | null;
	readonly datumMeters: number;
	readonly look: {
		readonly facts: readonly { readonly label: string; readonly value: string; readonly fieldId?: string }[];
		readonly writer: StageCardWriterRecord | null;
		readonly actions: readonly StageCardActionRecord[];
	};
	/** Adapter registration/disposal signal: a new fact reaches the Card at once. */
	readonly revision: number;
};

function locatorOf(entry: StageSelectionEntry): string {
	return `${entry.reference.domain}:${
		entry.reference.subject.kind === 'room' ? 'room-floor' : entry.reference.subject.kind
	}:${entry.reference.subject.id}`;
}

/** The plan-space centre used by both selection reveal and Index bring-into-view. */
function layoutWorldPoint(
	plan: PlanEvaluation | null,
	sourceId: string
): [number, number, number] | null {
	if (plan === null) return null;
	const fragment = planFragmentOf(plan, sourceId);
	if (fragment === undefined) return null;
	const points =
		fragment.geometry.kind === 'span'
			? [fragment.geometry.start, fragment.geometry.end]
			: fragment.geometry.kind === 'polyline'
				? fragment.geometry.polyline
				: fragment.geometry.polygon;
	if (points.length === 0) return null;
	const center = points.reduce<[number, number]>(
		(accumulator, point) => [
			accumulator[0] + point[0] / points.length,
			accumulator[1] + point[1] / points.length
		],
		[0, 0]
	);
	return [center[0], fragment.elevationMeters, center[1]];
}

/**
 * The read-only selection projection for one frame.
 *
 * A missing payload (a boot state or a refused decode) yields empty Index
 * rows, never a throw: the route still renders its boot surface.
 */
export function createStageSelectionView() {
	const worldIndexModel = createWorldIndexModel();
	let indexKey: {
		readonly snapshot: StageReadSnapshot | null;
		readonly envelope: ProjectEnvelope | null;
		readonly sceneRooms: ReadonlyMap<string, string>;
		readonly planView: PlanEvaluation | null;
		readonly subjects: readonly StageSubject[];
	} | null = null;
	let indexValue: StageIndexProjection | null = null;

	function indexFor(input: StageSelectionViewInput): StageIndexProjection {
		const cached = indexKey;
		if (
			cached !== null &&
			cached.snapshot === input.snapshot &&
			cached.envelope === input.envelope &&
			cached.sceneRooms === input.sceneRooms &&
			cached.planView === input.planView &&
			cached.subjects === input.subjects
		) {
			return indexValue!;
		}

		let layoutPayload: ReturnType<typeof stageLayout> | null = null;
		let scenePayload: ReturnType<typeof stageScene> | null = null;
		if (input.snapshot !== null) {
			try {
				layoutPayload = stageLayout(input.snapshot);
			} catch {
				layoutPayload = null;
			}
			try {
				scenePayload = stageScene(input.snapshot);
			} catch {
				scenePayload = null;
			}
		}

		const layoutNameOf = (sourceKind: string, sourceId: string): string | null => {
			if (layoutPayload === null) return null;
			if (sourceKind === 'wall') {
				return layoutPayload.walls.find((wall) => wall.id === sourceId)?.name ?? null;
			}
			if (sourceKind === 'opening') {
				return layoutPayload.openings.find((opening) => opening.id === sourceId)?.name ?? null;
			}
			if (sourceKind === 'room-floor' || sourceKind === 'room') {
				return layoutPayload.rooms.find((room) => room.id === sourceId)?.name ?? null;
			}
			return null;
		};

		const layoutKindWordOf = (sourceKind: string, sourceId: string): string => {
			if (sourceKind !== 'opening') return layoutKindWord(sourceKind);
			const opening = layoutPayload?.openings.find((candidate) => candidate.id === sourceId);
			return layoutKindWord(sourceKind, opening?.kind);
		};

		const sceneEntityOf = (entityId: string) =>
			scenePayload?.entities.find((entity) => entity.id === entityId) ?? null;

		const entries: StageIndexEntry[] = [];
		if (input.planView !== null) {
			for (const membership of input.planView.membership) {
				entries.push({
					group: membership.sourceKind,
					sourceId: `layout:${membership.sourceKind}:${membership.sourceId}`,
					kindWord: layoutKindWordOf(membership.sourceKind, membership.sourceId),
					name: layoutNameOf(membership.sourceKind, membership.sourceId),
					eligible: membership.eligible,
					revealed: membership.revealed,
					membership: membership.reason
				});
			}
		}
		for (const subject of input.subjects) {
				const entity =
					subject.reference.domain === 'scene' ? sceneEntityOf(subject.reference.subject.id) : null;
				entries.push({
					group: entity?.kind === 'light' ? 'light' : subject.reference.domain,
					sourceId: subject.id,
					kindWord: entity === null ? 'Subject' : sceneKindWord(entity.kind),
					name: entity?.name ?? null,
					eligible: true,
					revealed: false,
					membership: 'included'
				});
			}

		const labels = indexLabels(
				entries.map((entry): IndexLabelInput => ({
					identity: entry.sourceId,
					kind: entry.kindWord,
					name: entry.name
				}))
			);
		const entryMap = new Map(entries.map((entry) => [entry.sourceId, entry] as const));

		const worldIndex = worldIndexModel(
				layoutPayload,
				entries.map((entry) => ({
					...entry,
					label: labels.get(entry.sourceId)?.label ?? entry.kindWord,
					authored: labels.get(entry.sourceId)?.authored ?? false,
					kind: entry.kindWord
				})),
				input.snapshot?.domain.name ?? 'Project',
				input.envelope === null ? new Map() : input.sceneRooms
		);

		const value: StageIndexProjection = {
			layoutPayload,
			scenePayload,
			entries,
			labels,
			entryMap,
			worldIndex,
			sceneEntityOf
		};
		indexKey = {
			snapshot: input.snapshot,
			envelope: input.envelope,
			sceneRooms: input.sceneRooms,
			planView: input.planView,
			subjects: input.subjects
		};
		indexValue = value;
		return value;
	}

	return {
		read(input: StageSelectionViewInput): StageSelectionView {
			const index = indexFor(input);
			const { layoutPayload, scenePayload, entries, labels, entryMap, worldIndex, sceneEntityOf } = index;
			const selectedLocatorId =
				input.selection === null ? null : locatorOf(input.selection);
			const resolvedScope = resolveWorldScope(worldIndex, input.scope);
			const locationLabel = worldIndex.contexts
				.filter((context) => context.id === 'project' || context.id === resolvedScope)
				.map((context) => context.label)
				.join(' › ');

			const selectedMembership = ((): PlanMembershipReason | null => {
				const selected = input.selection;
				const plan = input.planView;
				if (plan === null || selected === null || selected.reference.domain !== 'layout') return null;
				return planMembershipOf(plan, selected.reference.subject.id)?.reason ?? null;
			})();

			const cardIdentity = ((): StageCardIdentity | null => {
				const selected = input.selection;
				if (selected === null) return null;
				const key = selectedLocatorId ?? '';
				const entry = entryMap.get(key);
				const label = labels.get(key);
				const domainWord = selected.reference.domain === 'layout' ? 'Layout' : 'Scene';
				return {
					sourceId: selected.reference.subject.id,
					label: label?.label ?? entry?.kindWord ?? domainWord,
					kind: entry?.kindWord ?? domainWord,
					status:
						selected.reference.domain !== 'layout'
							? domainWord
							: selectedMembership !== null
								? membershipLabel(selectedMembership)
								: 'Not in the current Plan'
				};
			})();

			const cardSubject = ((): StageCardSubject | null => {
				const selected = input.selection;
				if (selected === null) return null;
				return {
					sourceId: selected.reference.subject.id,
					sourceKind: selected.reference.subject.kind,
					reference: selected.reference,
					ref: selected.representation ?? null
				};
			})();

			const selectedArtwork = ((): SceneArtworkEntity | null => {
				if (cardSubject?.reference?.domain !== 'scene') return null;
				const entity = scenePayload?.entities.find((candidate) => candidate.id === cardSubject.sourceId);
				return entity?.kind === 'artwork' ? entity : null;
			})();

			const referenceLabel = (reference: StageSelectionEntry['reference']): string | null => {
				const kind = reference.subject.kind === 'room' ? 'room-floor' : reference.subject.kind;
				return labels.get(`${reference.domain}:${kind}:${reference.subject.id}`)?.label ?? null;
			};

			const selectedWorldPoint = (): [number, number, number] | null => {
				const plan = input.planView;
				const selected = input.selection;
				if (plan === null || selected === null) return null;
				if (selected.reference.domain !== 'layout') {
					const subject = input.subjects.find(
						(item) =>
							item.reference.domain === selected.reference.domain &&
							item.reference.subject.id === selected.reference.subject.id
					);
					return subject === undefined ? null : [...subject.worldPoint];
				}
				return layoutWorldPoint(plan, selected.reference.subject.id);
			};

			const sourceWorldPoint = (sourceId: string): [number, number, number] | null => {
				const subject = input.subjects.find((item) => item.id === sourceId);
				if (subject !== undefined) return [...subject.worldPoint];
				const layoutId = sourceId.startsWith('layout:')
					? sourceId.slice(sourceId.indexOf(':', 7) + 1)
					: sourceId;
				return layoutWorldPoint(input.planView, layoutId);
			};

			return {
				layoutPayload,
				scenePayload,
				entries,
				labels,
				entryMap,
				selectedLocatorId,
				worldIndex,
				resolvedScope,
				locationLabel,
				selectedMembership,
				cardIdentity,
				cardSubject,
				selectedArtwork,
				referenceLabel,
				selectedWorldPoint,
				sourceWorldPoint,
				sceneEntityOf
			};
		}
	};
}

/** The Card's contributed read for one selection; pure and write-free. */
export function stageWorldCardView(input: StageWorldCardInput): StageWorldCardView {
	void input.revision;
	const subject = input.subject;
	if (subject === null) {
		return { facts: [], nameWriter: null, writer: null, actions: [] };
	}
	const reference = subject.reference;
	if (reference === undefined) {
		return { facts: [], nameWriter: null, writer: null, actions: [] };
	}
	const own =
		reference.domain === 'layout'
			? [{ label: 'Datum', value: `${input.datumMeters} m` }]
			: [];
	return {
		facts: [
			...stageCardFacts(input.facade, subject, own),
			...input.look.facts
		],
		nameWriter: input.facade?.cardNameWriter(subject) ?? null,
		writer: input.look.writer ?? stageCardWriter(input.facade, subject),
		actions: [
			...(input.facade === null ? [] : stageCardActions(input.facade, subject)),
			...input.look.actions
		]
	};
}
