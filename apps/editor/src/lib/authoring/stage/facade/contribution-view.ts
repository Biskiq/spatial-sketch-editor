import { projectWorld, type Vec3, type ViewportEvaluation } from '@portfolio/camera-core';
import type { SemanticReference } from '@portfolio/project-model';
import type { StageReadSnapshot } from '../accepted-read';
import { primaryEntry, sameReference, type StageSelectionEntry, type StageSelectionState } from '../semantic-selection';
import { admitStageHandles, projectStageHandles, type StageHandleDescriptor, type StageHandleDiagnostic, type StageMarkView } from '../stage-handles';
import { mergeStageHeightTicks, type StageHeightTick } from '../stage-height-sheet';
import type { StageSession, StageLens, StageTask } from '../stage-session';
import type { AdapterContextHandle, BoundAdapter } from './adapter-bindings';
import type {
	StageAdapterContext, StageCardAction, StageCardActionRecord, StageCardFact, StageCardFactRecord,
	StageCardNameTarget, StageFindEntryRecord, StageGhostMesh, StageInkReadingRecord,
	StageInstrumentContent, StageOverlayContribution, StageSubject, StageTaskEntry
} from './adapter-contract';
import type { StageCandidatePreviewView, StageFacade, StageGuideView } from './view-contract';

type MarkAddress = { readonly adapterId: string; readonly id: string };

type ContributionViewPort = Pick<StageSession, 'selectionState' | 'hover' | 'task' | 'lens' | 'resizeHandles' | 'setResizeHandles'> & {
	readonly snapshot: () => StageReadSnapshot;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly isLive: () => boolean;
	readonly revision: () => number;
	readonly taskOwner: () => { readonly adapterId: string; readonly taskId: string } | null;
	readonly adapters: ReadonlyMap<string, BoundAdapter>;
	readonly adapterContext: () => AdapterContextHandle | null;
	readonly ensureBindings: () => void;
	readonly adapterForSelection: (entry: StageSelectionEntry) => BoundAdapter | undefined;
};

/** Retained projections of the current adapter contributions and mark view state. */
export function createContributionView(input: ContributionViewPort) {
	const { adapters, adapterContext, ensureBindings, isLive } = input;

	/**
	 * The inputs a contributed output array reads. Identities are compared, not
	 * contents: the session replaces its selection/task/hover records only when they
	 * change, and the accepted snapshot only when the source is installed.
	 */
	type OutputInputs = {
		readonly evaluation: ViewportEvaluation;
		readonly revision: number;
		readonly snapshot: StageReadSnapshot;
		readonly selection: StageSelectionState;
		readonly hover: StageSelectionEntry | null;
		readonly task: StageTask | null;
		readonly lens: StageLens;
	};
	function outputInputs(evaluation: ViewportEvaluation): OutputInputs {
		return {
			evaluation,
			revision: input.revision(),
			snapshot: input.snapshot(),
			selection: input.selectionState(),
			hover: input.hover(),
			task: input.task(),
			lens: input.lens()
		};
	}
	function sameOutputInputs(left: OutputInputs, right: OutputInputs): boolean {
		return (
			left.evaluation === right.evaluation &&
			left.revision === right.revision &&
			left.snapshot === right.snapshot &&
			left.selection === right.selection &&
			left.hover === right.hover &&
			left.task === right.task &&
			left.lens === right.lens
		);
	}
	let overlayOutput: { inputs: OutputInputs; value: readonly StageOverlayContribution[] } | null = null;
	let guideOutput: { inputs: OutputInputs; value: readonly StageGuideView[] } | null = null;
	let candidateOutput: { inputs: OutputInputs; value: readonly StageCandidatePreviewView[] } | null = null;
	let ghostOutput: { inputs: OutputInputs; value: readonly StageGhostMesh[] } | null = null;
	let markOutput: { inputs: OutputInputs; extra: string; value: readonly StageMarkView[] } | null = null;
	/**
	 * The last projected subject list. Adapter notifications also fire for
	 * selection and task changes, so `subjects()` must not allocate a fresh array
	 * for every one: the route keys its Index projection on this identity.
	 */
	let subjectsCache: readonly StageSubject[] | null = null;
	function invalidateSubjects(): void {
		subjectsCache = null;
	}
	/** Which mark the pointer is over; view state only. */
	let markHover: MarkAddress | null = null;
	/** The idle-hover mark whose hover state is owned by an adapter contribution. */
	let idleMarkHover: MarkAddress | null = null;
	/** The mark a live press started on, for gold emphasis and live tags. */
	let activeMarkId: string | null = null;
	/** Open disclosure ids for the current primary selection. */
	const openDisclosures = new Set<string>();
	/** The selection the disclosure set belongs to; a change closes every one. */
	let disclosureSelection: SemanticReference | null = null;
	const handleDiagnostics: StageHandleDiagnostic[] = [];
	const reportedHandleDiagnostics = new Set<string>();

	/** A selection change closes disclosure; a 2D ↔ 3D flip deliberately does not. */
	function syncDisclosureSelection(): void {
		const entry = primaryEntry(input.selectionState());
		const next = entry?.reference ?? null;
		// The full canonical address is the identity: a same-id subject at another
		// instance path or revision is a different selection and closes the set.
		if (next === null ? disclosureSelection === null : disclosureSelection !== null && sameReference(next, disclosureSelection)) return;
		disclosureSelection = next;
		openDisclosures.clear();
		markHover = null;
		activeMarkId = null;
	}

	/**
	 * The primary selection's admitted marks, projected through the live viewport.
	 *
	 * Asked only of the binding whose domain owns the primary selection, and only
	 * while no contributed task is open. Admission refusals are recorded once each
	 * and the mark is not returned, so "not drawn" and "not hit-testable" are the
	 * same fact.
	 */
	function admittedMarks(
		adapterEntry: NonNullable<ReturnType<typeof adapters.get>>,
		descriptors: readonly StageHandleDescriptor[],
		context: StageAdapterContext
	): readonly StageMarkView[] {
		if (descriptors.length === 0) return [];
		const admission = admitStageHandles({
			adapterId: adapterEntry.adapter.id,
			descriptors,
			plannerKinds: adapterEntry.adapter.plannerKinds ?? [],
			alreadyReported: reportedHandleDiagnostics
		});
		for (const diagnostic of admission.diagnostics) {
			reportedHandleDiagnostics.add(`${diagnostic.adapterId}\u0000${diagnostic.handleId}\u0000${diagnostic.code}`);
			handleDiagnostics.push(diagnostic);
		}
		const evaluation = context.evaluation;
		return projectStageHandles({
			adapterId: adapterEntry.adapter.id,
			descriptors: admission.admitted,
			openDisclosures: new Set([...openDisclosures, ...admission.admitted.filter(
				(mark) => mark.role === 'disclose' && mark.intent === 'resize' && input.resizeHandles()
			).map(mark => mark.id)]),
			hoveredId: markHover?.adapterId === adapterEntry.adapter.id ? markHover.id : null,
			activeId: activeMarkId,
			project: (point) => {
				const projected = projectWorld(point, evaluation, evaluation.token);
				// A behind-camera point mirrors through the origin; a clipped or
				// outside-frame point would paint outside the Stage. Neither is a mark
				// the creator can see and press.
				return projected.kind === 'projected' && projected.visibility === 'visible'
					? projected.css
					: null;
			},
			offset: [evaluation.rect.left, evaluation.rect.top]
		});
	}

	/**
	 * R217.S25: the Experience lens reads a settled World. Every mark the adapters publish (move,
	 * turn, size, wall ends) is World editing, so none is drawn or hit there.
	 */
	function worldMarksOffered(): boolean {
		return input.lens() !== 'experience';
	}

	function selectionMarks(): readonly StageMarkView[] {
		if (!isLive() || !worldMarksOffered()) return [];
		syncDisclosureSelection();
		const taskOpen = input.task() !== null;
		const taskMarkOwner = taskOpen ? openTaskMarkOwner() : null;
		if (taskOpen && taskMarkOwner === null) return [];
		const entry = primaryEntry(input.selectionState());
		if (entry === null) return [];
		ensureBindings();
		const adapterEntry = input.adapterForSelection(entry);
		if (adapterEntry === undefined) return [];
		if (taskMarkOwner !== null && adapterEntry.adapter.id !== taskMarkOwner) return [];
		const handle = adapterContext();
		if (handle === null) return [];
		let descriptors: readonly StageHandleDescriptor[] = [];
		try { descriptors = adapterEntry.contributions.handles?.(handle.context) ?? []; }
		catch { descriptors = []; }
		try {
			return admittedMarks(adapterEntry, descriptors, handle.context);
		} finally {
			handle.end();
		}
	}

	function idleMarks(): readonly StageMarkView[] {
		if (!isLive() || input.task() !== null || !worldMarksOffered()) return [];
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return [];
		const marks: StageMarkView[] = [];
		try {
			for (const entry of adapters.values()) {
				let descriptors: readonly StageHandleDescriptor[] = [];
				try { descriptors = entry.contributions.idleHandles?.(handle.context) ?? []; }
				catch { descriptors = []; }
				marks.push(...admittedMarks(entry, descriptors, handle.context));
			}
		} finally {
			handle.end();
		}
		return marks;
	}

	function stageMarks(): readonly StageMarkView[] {
		return [...selectionMarks(), ...idleMarks()];
	}


	/**
	 * The adapter whose marks may stay visible under the open contributed task.
	 * A task that opts into `marksWhileOpen` owns only its own selection marks;
	 * another adapter's selected subject must not leak through the task surface.
	 */
	function openTaskMarkOwner(): string | null {
		const owner = input.taskOwner();
		if (owner === null) return null;
		ensureBindings();
		const task = tasksOf().find(
			(entry) =>
				entry.adapterId === owner.adapterId &&
				entry.id === owner.taskId &&
				entry.marksWhileOpen === true
		);
		return task?.adapterId ?? null;
	}

	/** Deterministic order: explicit `order`, then owning adapter ID, then entry ID. */
	function compareEntries(
		a: { readonly adapterId: string; readonly order: number; readonly id: string },
		b: { readonly adapterId: string; readonly order: number; readonly id: string }
	): number {
		if (a.order !== b.order) return a.order - b.order;
		if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
		return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
	}

	function tasksOf(): readonly StageTaskEntry[] {
		return [...adapters.entries()]
			.flatMap(([adapterId, entry]) =>
				(entry.contributions.tasks ?? []).map((task) => ({
					...task,
					adapterId,
					order: task.order ?? 0
				}))
			)
			.sort(compareEntries);
	}

	function inkReadingsOf(): readonly StageInkReadingRecord[] {
		return [...adapters.entries()]
			.flatMap(([adapterId, entry]) =>
				(entry.contributions.readings ?? []).map((reading) => ({
					id: reading.id,
					label: reading.label,
					summary: reading.summary,
					order: reading.order ?? 0,
					adapterId,
					...(reading.view === undefined ? {} : { view: reading.view })
				}))
			)
			.sort(compareEntries);
	}

	function findEntriesOf(): readonly StageFindEntryRecord[] {
		return [...adapters.entries()]
			.flatMap(([adapterId, entry]) =>
				(entry.contributions.findEntries ?? []).map((findEntry) => ({
					...findEntry,
					adapterId,
					order: findEntry.order ?? 0
				}))
			)
			.sort(compareEntries);
	}
	const marks: StageFacade['marks'] = () => {
		if (!isLive()) return [];
		ensureBindings();
		const evaluation = input.evaluation();
		if (evaluation === null) return [];
		const inputs = outputInputs(evaluation);
		// Marks also read hover, disclosure, press and resize-handle state, none of
		// which is an adapter-surface change; they are part of the key so a hover
		// still updates while an unchanged frame returns the previous array.
		const extra = [
			markHover?.adapterId ?? '',
			markHover?.id ?? '',
			idleMarkHover?.adapterId ?? '',
			idleMarkHover?.id ?? '',
			activeMarkId ?? '',
			[...openDisclosures].sort().join(','),
			input.resizeHandles() ? '1' : '0'
		].join('|');
		if (
			markOutput !== null &&
			sameOutputInputs(markOutput.inputs, inputs) &&
			markOutput.extra === extra
		) {
			return markOutput.value;
		}
		const value = stageMarks();
		markOutput = { inputs, extra, value };
		return value;
	};
	const setMarkHover: StageFacade['setMarkHover'] = (mark) => {
		if (!isLive()) return;
		markHover = mark === null ? null : { adapterId: mark.adapterId, id: mark.id };
		if (mark === null || mark.adapterId !== idleMarkHover?.adapterId || mark.id !== idleMarkHover.id) {
			idleMarkHover = null;
		}
	};
	const activateDisclosure: StageFacade['activateDisclosure'] = (id) => {
		if (!isLive()) return false;
		const mark = stageMarks().find((candidate) => candidate.id === id);
		if (mark === undefined || mark.role !== 'disclose') return false;
		if (mark.descriptor.role === 'disclose' && mark.descriptor.intent === 'resize') {
			input.setResizeHandles(!input.resizeHandles());
			return true;
		}
		if (openDisclosures.has(id)) openDisclosures.delete(id);
		else openDisclosures.add(id);
		return true;
	};
	const closeDisclosure: StageFacade['closeDisclosure'] = () => {
		if (openDisclosures.size === 0) return false;
		openDisclosures.clear();
		return true;
	};
	const overlays: StageFacade['overlays'] = () => {
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return [];
		// Adapters project through the Camera's viewport CSS; the overlay paints
		// inside the Stage surface. The one accepted evaluation rect is the only
		// translation, applied here so no adapter has to know the surface offset
		// and no marker can be painted one Index panel to the right of its target.
		const { left, top } = handle.context.evaluation.rect;
		const inputs = outputInputs(handle.context.evaluation);
		if (overlayOutput !== null && sameOutputInputs(overlayOutput.inputs, inputs)) {
			return overlayOutput.value;
		}
		const value = [...adapters.values()].flatMap((entry) => {
			try {
				return (entry.contributions.overlay?.(handle.context) ?? []).map((marker) => ({
					...marker,
					css: [marker.css[0] - left, marker.css[1] - top] as const
				}));
			} catch { return []; }
		});
		overlayOutput = { inputs, value };
		return value;
	};
	const guides: StageFacade['guides'] = () => {
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return [];
		const { left, top } = handle.context.evaluation.rect;
		const inputs = outputInputs(handle.context.evaluation);
		if (guideOutput !== null && sameOutputInputs(guideOutput.inputs, inputs)) {
			return guideOutput.value;
		}
		const project = (world: Vec3): readonly [number, number] | null => {
			if (world.length !== 3 || !world.every(Number.isFinite)) return null;
			const projected = handle.context.project(world);
			return projected === null ? null : [projected[0] - left, projected[1] - top];
		};
		const segmentsOf = (
			segments: readonly (readonly [Vec3, Vec3])[]
		): readonly (readonly [readonly [number, number], readonly [number, number]])[] =>
			segments.flatMap(([from, to]) => {
				const a = project(from);
				const b = project(to);
				return a === null || b === null ? [] : [[a, b] as const];
			});
		const value = [...adapters.values()].flatMap((entry) => {
			try {
				return (entry.contributions.guides?.(handle.context) ?? []).map((guide) => ({
					id: guide.id,
					role: guide.role,
					segments: segmentsOf(guide.segments),
					derivedSegments: segmentsOf(guide.derivedSegments ?? []),
					labels: (guide.labels ?? []).flatMap((label) => {
						const point = project(label.world);
						return point === null ? [] : [{ css: point, text: label.text }];
					})
				}));
			} catch {
				return [];
			}
		});
		guideOutput = { inputs, value };
		return value;
	};
	const candidatePreviews: StageFacade['candidatePreviews'] = () => {
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return [];
		const { left, top } = handle.context.evaluation.rect;
		const inputs = outputInputs(handle.context.evaluation);
		if (candidateOutput !== null && sameOutputInputs(candidateOutput.inputs, inputs)) {
			return candidateOutput.value;
		}
		// One projection, at the same boundary the overlay uses. World points an
		// adapter contributes are never translated again by it.
		const css = (world: Vec3): readonly [number, number] | null => {
			if (world.length !== 3 || !world.every(Number.isFinite)) return null;
			const projected = handle.context.project(world);
			return projected === null ? null : [projected[0] - left, projected[1] - top];
		};
		const value = [...adapters.values()].flatMap((entry) => {
			try {
				return (entry.contributions.candidatePreview?.(handle.context) ?? []).flatMap(
					(candidate): StageCandidatePreviewView[] => {
						const polygons = candidate.polygons.flatMap((polygon) => {
							const points = polygon.map(css);
							return points.length >= 3 && points.every((point) => point !== null)
								? [points as readonly (readonly [number, number])[]]
								: [];
						});
						const segments = candidate.segments.flatMap(([from, to]) => {
							const a = css(from);
							const b = css(to);
							return a === null || b === null ? [] : [[a, b] as const];
						});
						const labels = candidate.labels.flatMap((label) => {
							const point = css(label.world);
							return point === null ? [] : [{ css: point, text: label.text }];
						});
						const snapPoint = candidate.snap === undefined ? null : css(candidate.snap.world);
						return [{
							id: candidate.id,
							role: candidate.role,
							drawing: candidate.drawing,
							polygons,
							segments,
							labels,
							...(snapPoint === null || candidate.snap === undefined
								? {}
								: { snap: { css: snapPoint, name: candidate.snap.name } })
						}];
					}
				);
			} catch { return []; }
		});
		candidateOutput = { inputs, value };
		return value;
	};
	const graphics: StageFacade['graphics'] = () => {
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return [];
		return [...adapters.values()].flatMap((entry) => {
			try { return entry.contributions.graphics?.(handle.context) ?? []; } catch { return []; }
		});
	};
	const ghosts: StageFacade['ghosts'] = () => {
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return [];
		const inputs = outputInputs(handle.context.evaluation);
		if (ghostOutput !== null && sameOutputInputs(ghostOutput.inputs, inputs)) {
			return ghostOutput.value;
		}
		const value = [...adapters.values()].flatMap((entry) => {
			try { return entry.contributions.ghosts?.(handle.context) ?? []; } catch { return []; }
		});
		ghostOutput = { inputs, value };
		return value;
	};
	const tasks: StageFacade['tasks'] = () => {
		ensureBindings();
		return tasksOf();
	};
	const inkReadings: StageFacade['inkReadings'] = () => {
		ensureBindings();
		return inkReadingsOf();
	};
	const subjects: StageFacade['subjects'] = () => {
		ensureBindings();
		if (subjectsCache === null) {
			subjectsCache = [...adapters.values()].flatMap((entry) => entry.contributions.subjects ?? []);
		}
		return subjectsCache;
	};
	const findEntries: StageFacade['findEntries'] = () => {
		ensureBindings();
		return findEntriesOf();
	};
	const cardFacts: StageFacade['cardFacts'] = (subject) => {
		ensureBindings();
		const facts: StageCardFactRecord[] = [];
		for (const [adapterId, entry] of adapters.entries()) {
			let contributed: readonly StageCardFact[] = [];
			try { contributed = entry.contributions.cardFacts?.(subject) ?? []; } catch { contributed = []; }
			for (const fact of contributed) facts.push({ ...fact, adapterId });
		}
		return facts.sort((a, b) => {
			if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
			return a.label === b.label ? 0 : a.label < b.label ? -1 : 1;
		});
	};
	const cardWriter: StageFacade['cardWriter'] = (subject) => {
		if (!isLive()) return null;
		ensureBindings();
		// Deterministic owner, exactly like the name writer: adapter ID order, so
		// two adapters cannot disagree about which fields the Card shows.
		const ids = [...adapters.keys()].sort();
		for (const adapterId of ids) {
			const entry = adapters.get(adapterId);
			if (entry?.contributions.cardWriter === undefined) continue;
			let content: StageInstrumentContent | null = null;
			try { content = entry.contributions.cardWriter(subject); } catch { content = null; }
			if (content !== null) return { ...content, adapterId };
		}
		return null;
	};
	const cardActions: StageFacade['cardActions'] = (subject) => {
		if (!isLive()) return [];
		ensureBindings();
		const actions: StageCardActionRecord[] = [];
		for (const [adapterId, entry] of adapters.entries()) {
			let contributed: readonly StageCardAction[] = [];
			try { contributed = entry.contributions.cardActions?.(subject) ?? []; } catch { contributed = []; }
			for (const action of contributed) actions.push({ ...action, adapterId });
		}
		return actions.sort((a, b) => {
			if (a.adapterId !== b.adapterId) return a.adapterId < b.adapterId ? -1 : 1;
			return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
		});
	};
	const cardNameWriter: StageFacade['cardNameWriter'] = (subject) => {
		if (!isLive()) return null;
		ensureBindings();
		// Deterministic owner: adapter ID order, so two adapters cannot disagree
		// about which writer the Card shows on different renders.
		const ids = [...adapters.keys()].sort();
		for (const adapterId of ids) {
			const entry = adapters.get(adapterId);
			if (entry?.contributions.cardName === undefined) continue;
			let target: StageCardNameTarget | null = null;
			try { target = entry.contributions.cardName(subject); } catch { target = null; }
			if (target !== null) return { ...target, adapterId };
		}
		return null;
	};

	function resetMarks(): void {
		openDisclosures.clear();
		markHover = null;
		idleMarkHover = null;
		activeMarkId = null;
	}

	function setActiveMark(mark: MarkAddress | null): void {
		activeMarkId = mark?.id ?? null;
		if (mark !== null) markHover = mark;
	}

	function setIdleMark(mark: MarkAddress | null): void {
		if (mark !== null) {
			idleMarkHover = mark;
			markHover = mark;
			return;
		}
		if (idleMarkHover !== null && markHover?.adapterId === idleMarkHover.adapterId && markHover.id === idleMarkHover.id) {
			markHover = null;
		}
		idleMarkHover = null;
	}

	function heightTicks(): readonly StageHeightTick[] | null {
		ensureBindings();
		const handle = adapterContext();
		if (handle === null) return null;
		const declared: StageHeightTick[] = [];
		for (const entry of adapters.values()) {
			try {
				declared.push(...(entry.contributions.heightTicks?.(handle.context) ?? []));
			} catch {
				// A contributor that throws contributes no tick; the rest still count.
			}
		}
		const merged = mergeStageHeightTicks(declared);
		return mergeStageHeightTicks(declared);
	}


	return {
		syncDisclosureSelection,
		resetMarks,
		setActiveMark,
		setIdleMark,
		selectionMarks,
		idleMarks,
		stageMarks,
		marks,
		setMarkHover,
		activateDisclosure,
		closeDisclosure,
		worldMarksOffered,
		overlays,
		guides,
		candidatePreviews,
		graphics,
		ghosts,
		heightTicks,
		tasks,
		tasksOf,
		inkReadings,
		inkReadingsOf,
		subjects,
		findEntries,
		findEntriesOf,
		cardFacts,
		cardWriter,
		cardActions,
		cardNameWriter,
		invalidateSubjects,
		handleDiagnostics: () => handleDiagnostics,
	};
}
