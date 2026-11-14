import { intersectWorkingPlane, pointerRay, projectWorld, type PointerRay, type Vec3 } from '@portfolio/camera-core';
import { requestCameraOutput } from '@portfolio/project-model';
import type { SceneRenderedHit } from '$lib/authoring/scene/scene-pick-source';
import type { StageReadSnapshot } from './accepted-read';
import { createCameraSession, evaluationIdOf } from './camera-session';
import { createAdapterBindings, SKIP_REBIND_CONTROL } from './facade/adapter-bindings';
import { createContributionView } from './facade/contribution-view';
import { createPlanView } from './facade/plan-view';
import { adapterForSelection, createSelectionPick } from './facade/selection-pick';
import type { StageFacade } from './facade/view-contract';
import { PLAN_DEFAULT_CUT_HEIGHT_METERS } from './plan-parameters';
import { primaryEntry, type StageSelectionChange, type StageSelectionState } from './semantic-selection';
import type { StageLightPreview } from './stage-light-preview.svelte';
import type { StageSelection, StageSession, StageTask } from './stage-session';

export { HOST_STAGE_CAPABILITIES, SKIP_REBIND_CONTROL } from './facade/adapter-bindings';
export { datumWorkingPlane } from './facade/selection-pick';
export type * from './facade/adapter-contract';
export type * from './facade/view-contract';

/**
 * The Stage host coordinates accepted content, canonical session selection and Camera
 * output tickets. It delegates binding lifetimes and view reads to facade owners.
 */
export function createStageFacade(input: {
	readonly snapshot: StageReadSnapshot;
	readonly session: StageSession;
	readonly viewportId?: string;
	readonly outputId?: string;
	readonly scenePick?: (ray: PointerRay, scene: StageReadSnapshot['domain']['scene']) => SceneRenderedHit | null;
	readonly sceneBounds?: (id: string, scene: StageReadSnapshot['domain']['scene']) => { readonly min: Vec3; readonly max: Vec3 } | null;
	/** The session-only light preview the editor shell merges into its render. */
	readonly lightPreview?: StageLightPreview | null;
}): StageFacade {
	const { session } = input;
	let currentSnapshot = input.snapshot;
	const camera = createCameraSession({
		snapshot: currentSnapshot,
		viewportId: input.viewportId ?? 'stage',
		// The output identity is unique per *replacement lifetime*, not per epoch string:
		// a host that re-admitted under the same session epoch still gets a fresh output,
		// so a retained ticket from the previous project cannot qualify against it.
		outputId: input.outputId ?? `output:${currentSnapshot.sessionEpoch}:${session.token().epoch}`
	});
	/** The host's own inspection run order, minted strictly newer than every accepted epoch. */
	let inspectionRun = 0;
	const lifetimeToken = session.token();
	let disposed = false;
	const isLive = () => !disposed && session.isCurrent(lifetimeToken);
	let contributedTaskOwner: { adapterId: string; taskId: string } | null = null;
	/** The adapter that claimed the live press, if any. Cleared on up/cancel/close. */
	let pointerOwner: string | null = null;
	/**
	 * The next host inspection run epoch. It is monotonic over this output's whole
	 * session, including across a source rebase (which keeps the epoch floor), so a
	 * re-acquisition can never re-enter with a spent epoch.
	 */
	function nextInspectionRun(): number {
		inspectionRun = Math.max(inspectionRun + 1, camera.output().epochFloor + 1);
		return inspectionRun;
	}

	const bindings = createAdapterBindings({
		isLive,
		isDisposed: () => disposed,
		snapshot: () => currentSnapshot,
		evaluation: camera.evaluation,
		evaluationId: camera.evaluationId,
		idOf: evaluationIdOf,
		cameraState: camera.state,
		pickScene: input.scenePick,
		sceneBounds: input.sceneBounds,
		selection: session.selection,
		selectionState: session.selectionState,
		drafting: session.drafting,
		select,
		setSelection,
		requestIntent: (intent, clockSeconds) =>
			facade.requestViewingIntent(intent, camera.inspectionTicket(), clockSeconds),
		registrationRemoved: (adapterId) => {
			if (contributedTaskOwner?.adapterId === adapterId) {
				contributedTaskOwner = null;
				session.closeTask();
			}
		},
		addDisposable: session.addDisposable,
		invalidateSubjects: () => contributions.invalidateSubjects()
	});
	const { entries: adapters, adapterContext, ensureBindings, rebindAdapters, notifyAdaptersChanged } = bindings;
	const contributions = createContributionView({
		adapters,
		adapterContext,
		ensureBindings,
		isLive,
		evaluation: camera.evaluation,
		snapshot: () => currentSnapshot,
		revision: bindings.revision,
		taskOwner: () => contributedTaskOwner,
		selectionState: session.selectionState,
		hover: session.hover,
		task: session.task,
		lens: session.lens,
		resizeHandles: session.resizeHandles,
		setResizeHandles: session.setResizeHandles,
		adapterForSelection: (entry) => adapterForSelection(adapters, entry)
	});
	const picking = createSelectionPick({
		adapters,
		adapterContext,
		ensureBindings,
		isLive,
		evaluation: camera.evaluation,
		idOf: evaluationIdOf,
		selectionMarks: contributions.selectionMarks,
		idleMarks: contributions.idleMarks,
		toolOwner: () => contributedTaskOwner?.adapterId ?? null
	});
	const planView = createPlanView({
		snapshot: () => currentSnapshot,
		target: () => camera.state().pose.target
	});
	/** The Sheet's role registration; one per facade lifetime, released on dispose. */
	let planCutUnsubscribe: (() => void) | null = null;

	function select(selection: StageSelection | null): void {
		if (!isLive()) return;
		session.select(selection);
		contributions.syncDisclosureSelection();
		bindings.echoSelection();
		notifyAdaptersChanged();
	}

	function setSelection(value: StageSelectionState): StageSelectionChange {
		if (!isLive()) return { kind: 'refused', code: 'stale-session', message: 'This Stage lifetime has ended.' };
		const result = session.setSelection(value);
		if (result.kind === 'selected') { contributions.syncDisclosureSelection(); bindings.echoSelection(); notifyAdaptersChanged(); }
		return result;
	}

	/** Tell every binding its contributed task is gone, exactly once per close. */
	function notifyTaskClosed(): void {
		pointerOwner = null;
		// An accepted install closes the contributed task through the session, not
		// through `closeTask()`; the owner record must end with it, or the host
		// keeps offering presses and keys to a task that no longer exists and
		// never reaches a binding's no-task direct manipulation.
		contributedTaskOwner = null;
		bindings.notifyTaskClosed();
	}

	const facade: StageFacade = {
		snapshot: () => currentSnapshot,
		lightPreview: () => input.lightPreview ?? null,
		session,
		camera,
		evaluation: () => camera.evaluation(),
		evaluationId: () => camera.evaluationId(),
		sceneBounds: (id) => input.sceneBounds?.(id, currentSnapshot.domain.scene) ?? null,
		projectWorld(point, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return projectWorld(point, evaluation, evaluation.token);
		},
		pointerRay(cssPoint, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return pointerRay(cssPoint, evaluation, evaluation.token);
		},
		intersectWorkingPlane(ray, plane, evaluationId) {
			const evaluation = camera.evaluation();
			if (evaluation === null || evaluationIdOf(evaluation) !== evaluationId) {
				return {
					kind: 'failed',
					code: 'stale-evaluation',
					message: 'the supplied evaluation id is not the current viewport output'
				};
			}
			return intersectWorkingPlane(ray, plane, evaluation, evaluation.token);
		},
		requestViewingIntent(intent, ticket, clockSeconds) {
			if (!isLive()) return { kind: 'superseded', state: camera.state(), message: 'the Stage lifetime has ended' };
			// Ownership is the landed ticket protocol's answer, never a field
			// comparison: a ticket for another output, host session or source revision,
			// or one whose run epoch this output already spent, cannot drive it. A run
			// that no longer owns the output is told so (`superseded`) instead of being
			// left to write into an output it no longer holds — which is what makes a
			// prior-epoch completion unable to install its intent after a replacement or
			// a content change.
			const decision = requestCameraOutput(camera.output(), ticket);
			if (decision.kind !== 'accepted') {
				return {
					kind: 'superseded',
					state: camera.state(),
					message:
						decision.kind === 'refused'
							? `the stage inspection output refused this ticket: ${decision.reason}`
							: 'the inspection output is held by another run; acquire it before requesting a viewing intent',
					...(decision.kind === 'refused' ? { reason: decision.reason } : {})
				};
			}
			const result = camera.applyIntent(intent, clockSeconds);
			// A reading change is the one projection move a captured gesture must be told
			// about, and it happens at the *next* evaluation — `applyIntent` only moves
			// session state. Running the live lease's policy here is therefore strictly
			// before the projection changes, and it runs exactly once per accepted
			// request, whether the request came from the keyboard, the toolbar or an
			// adapter's `requestIntent`.
			if (result.kind === 'accepted' && intent.kind === 'set-reading') {
				session.applyReadingChange();
			}
			return result;
		},
		drafting: () => session.drafting(),
		setDrafting: (patch) => session.setDrafting(patch),
		heightSheet: () => session.heightSheet(),
		heightTicks() {
			const merged = contributions.heightTicks();
			if (merged === null) return [];
			// The Sheet's range follows the surfaces its owners actually declared,
			// plus one metre of headroom. The default cut is itself a known height,
			// so an enclosure with no found surface still has a metre above it to
			// explore. The cap never moves the current height; it only bounds the
			// next creator action.
			const highest = merged.length === 0 ? 0 : merged[merged.length - 1]!.heightMeters;
			const sheet = session.heightSheet();
			sheet.setMaxHeightMeters(
				Math.max(PLAN_DEFAULT_CUT_HEIGHT_METERS + 1, highest + 1, sheet.height())
			);
			return merged;
		},
		acquireInspection(policy = 'exclusive') {
			// The host owns one inspection output, so it mints its own run order: every
			// claim this facade acquires is strictly newer than any epoch the output has
			// already accepted, and the observation it presents is the live one.
			return camera.acquireInspection(policy, nextInspectionRun());
		},
		inspectionClaim: () => camera.output().claim,
		inspectionTicket: () => camera.inspectionTicket(),
		installAccepted(next, options) {
			if (!isLive()) {
				return { kind: 'refused', code: 'disposed', message: 'the stage is disposed and installs no source' };
			}
			const previous = currentSnapshot;
			if (next.acceptedRevision.projectId !== previous.acceptedRevision.projectId) {
				return {
					kind: 'refused',
					code: 'different-project',
					message: 'a different project identity is a replacement, not a content change'
				};
			}
			if (next.sourceContentId === previous.sourceContentId) {
				// Identical content: the claim, the selection and the task all still mean
				// what they meant, so nothing is rebased and nothing is re-acquired.
				return { kind: 'unchanged', sourceContentId: next.sourceContentId, claim: camera.output().claim };
			}
			const requalify = options?.requalify;
			const installed = session.installAccepted(next, { requalify, requalifyEntry: options?.requalifyEntry });
			if (installed.kind !== 'installed') {
				// The session holds one accepted-source slot, so this is the "nothing
				// mounted yet" case; a disposed or divergent session is named as such.
				return {
					kind: 'refused',
					code:
						installed.kind === 'refused' && installed.code === 'disposed'
							? 'disposed'
							: installed.kind === 'refused' && installed.code === 'stale-session'
								? 'stale-session'
								: 'no-current-source',
					message:
						installed.kind === 'refused'
							? installed.message
							: 'the session reports identical content for a changed source'
				};
			}
			const endedClaim = camera.output().claim;
			// The source rebase ends the live claim (its intent was evaluated against the
			// old content) without touching the pose, and the host re-acquires at once.
			camera.rebaseSource(next.sourceContentId, next.domain.geometry.bounds ?? null, next.domain.datumMeters);
			currentSnapshot = next;
			// A replacement closes disclosure: the grips it revealed belong to the
			// source that was replaced, not to whatever now shares its identity.
			contributions.resetMarks();
			// Every factory-bound adapter is rebuilt for *this* snapshot: the registration
			// survives the edit, each previous binding is disposed exactly once, and its
			// replacements were built from the source that is now mounted.
			const reboundAdapters = options?.[SKIP_REBIND_CONTROL] === true ? [] : rebindAdapters();
			// Static bindings receive the requalified selection before task and surface notifications.
			bindings.echoStaticSelection(
				installed.requalification.kind === 'requalified' ? installed.requalification.selection : null
			);
			const acquired = camera.acquireInspection('exclusive', nextInspectionRun());
			// End the closed task's adapters before telling the surface, so a listener
			// that rebuilds its contribution views sees one settled state. Only a closed
			// task forces a synchronous signal: a plain content change keeps the
			// deferred, read-discovered rebuild (the surface must not be notified from
			// inside a derivation). A panel that was showing the task has to learn now
			// that it is gone, or it keeps rendering an instrument whose services can
			// no longer act.
			if (installed.closedTask) {
				notifyTaskClosed();
				notifyAdaptersChanged();
			}
			return {
				kind: 'installed',
				previousSourceContentId: previous.sourceContentId,
				sourceContentId: next.sourceContentId,
				pose: camera.state().pose,
				endedClaim,
				claim: acquired.kind === 'acquired' ? acquired.claim : null,
				reboundAdapters,
				clearedSelection: installed.clearedSelection,
				closedTask: installed.closedTask,
				releasedGestures: installed.releasedGestures,
				requalification: installed.requalification,
				selectionRemovals: installed.selectionRemovals
			};
		},
		adoptMetadata(next) {
			if (!isLive()) return { kind: 'refused', code: 'disposed', message: 'The Stage session has ended.' };
			const adopted = session.adoptMetadata(next);
			if (adopted.kind !== 'adopted') return adopted;
			// Metadata-only source bytes still get a fresh identity. Rebase the one
			// camera output at its existing pose, then rebuild bound adapters against
			// the new authored envelope while retaining the session's selection/task.
			camera.rebaseSource(next.sourceContentId, next.domain.geometry.bounds ?? null, next.domain.datumMeters);
			currentSnapshot = next;
			// Metadata still replaces the accepted bytes: a disclosed grip set belongs
			// to the source it was opened against and must not survive the swap.
			contributions.resetMarks();
			rebindAdapters();
			camera.acquireInspection('exclusive', nextInspectionRun());
			notifyAdaptersChanged();
			return adopted;
		},
		plan: planView.plan,
		planDependencyKey: planView.planDependencyKey,
		setPlanParameters: planView.setPlanParameters,
		eligibleFragments: planView.eligibleFragments,
		resolveSourceHit(candidate) {
			return facade.resolvePick({ ...candidate, purpose: 'select', tool: null });
		},
		resolvePick: picking.resolvePick,
		hostToolTarget: picking.hostToolTarget,
		eraseAnswer: picking.eraseAnswer,
		marks: contributions.marks,
		hitMark: picking.hitMark,
		idleHoverIntent(intent) {
			if (!isLive()) return null;
			ensureBindings();
			const evaluation = camera.evaluation();
			const allowed = intent.phase === 'move' &&
				session.task() === null &&
				session.gesture() === null &&
				intent.coarse !== true &&
				evaluation !== null &&
				evaluationIdOf(evaluation) === intent.evaluationId &&
				intent.css.every(Number.isFinite) &&
				picking.hitMark({ css: intent.css, coarse: false }) === null;
			const handle = adapterContext();
			if (handle === null) {
				contributions.setIdleMark(null);
				return null;
			}
			let contributed = false;
			try {
				if (allowed) {
					for (const entry of adapters.values()) {
						const update = entry.contributions.idleHoverIntent;
						if (update === undefined) continue;
						try {
							contributed = update(intent, handle.context) || contributed;
						} catch { /* A throwing idle-hover contribution names no mark. */ }
					}
				} else {
					const cancel = { ...intent, phase: 'cancel' as const };
					for (const entry of adapters.values()) {
						try { entry.contributions.idleHoverIntent?.(cancel, handle.context); }
						catch { /* Subscriber isolation. */ }
					}
				}
			} finally {
				handle.end();
			}
			if (!contributed) {
				contributions.setIdleMark(null);
				return null;
			}
			const hit = picking.hitIdleMark(intent.css);
			if (hit === null) {
				contributions.setIdleMark(null);
				return null;
			}
			contributions.setIdleMark({ adapterId: hit.adapterId, id: hit.id });
			return hit;
		},
		setMarkHover: contributions.setMarkHover,
		activateDisclosure: contributions.activateDisclosure,
		closeDisclosure: contributions.closeDisclosure,
		handleDiagnostics: contributions.handleDiagnostics,
		selection: () => session.selection(),
		selectionState: () => session.selectionState(),
		setSelection,
		select,
		openTask: (task) => { if (!isLive()) return false; contributedTaskOwner = null; return session.openTask(task); },
		closeTask: () => {
			if (!isLive()) return false;
			contributedTaskOwner = null;
			const closed = session.closeTask();
			// A closed task owns no press and no proposal: tell its adapter now, so the
			// session's one cancel path runs here rather than at unmount.
			if (closed) notifyTaskClosed();
			notifyAdaptersChanged();
			return closed;
		},
		changeLens(next) {
			if (!isLive() || !session.changeLens(next)) return false;
			contributions.resetMarks();
			// A lens exit ends bindings as well as writers. Old callbacks cannot become live on return.
			rebindAdapters();
			notifyAdaptersChanged();
			return true;
		},
		resumeTask() {
			if (!isLive()) return { kind: 'refused', code: 'stale-session', message: 'This Stage lifetime has ended.' };
			ensureBindings();
			const owner = contributedTaskOwner;
			const entry = owner ? contributions.tasksOf().find((candidate) => candidate.adapterId === owner.adapterId && candidate.id === owner.taskId) : null;
			const result = session.resumeTask((task, snapshot) => {
				// The owning adapter may simply not be bound right now (a lens whose view
				// supplies no evaluation defers its bindings). Say so, instead of claiming
				// the capability was removed from a live adapter.
				if (owner && !entry) return { kind: 'refused', code: 'binding-unavailable', message: 'This capability is not bound in this lens. Return to its lens and resume again.' };
				if (entry && !entry.revalidate) return { kind: 'refused', code: 'resume-unavailable', message: 'This adapter cannot revalidate its task. Close it and invoke it again.' };
				return entry?.revalidate?.(task, snapshot) ?? { kind: 'resumed' };
			});
			if (result.kind === 'resumed') rebindAdapters();
			notifyAdaptersChanged();
			return result;
		},
		registerStageAdapter: bindings.registerStageAdapter,
		adapters: bindings.adapters,
		onAdaptersChanged: bindings.onAdaptersChanged,
		overlays: contributions.overlays,
		guides: contributions.guides,
		candidatePreviews: contributions.candidatePreviews,
		graphics: contributions.graphics,
		ghosts: contributions.ghosts,
		tasks: contributions.tasks,
		inkReadings: contributions.inkReadings,
		openInkReading(id, adapterId) {
			if (!isLive()) return null;
			ensureBindings();
			const record = contributions.inkReadingsOf().find(
				(candidate) => candidate.id === id && (adapterId === undefined || candidate.adapterId === adapterId)
			);
			if (record === undefined) return null;
			const reading = adapters
				.get(record.adapterId)
				?.contributions.readings?.find((candidate) => candidate.id === record.id);
			if (reading === undefined) return null;
			try {
				return { reading: record, session: reading.begin() };
			} catch {
				return null;
			}
		},
		instrumentForTask(id, adapterId) {
			if (!isLive() || session.task() === null) return null;
			ensureBindings();
			const entry = contributions.tasksOf().find((candidate) => candidate.id === id && (adapterId === undefined || candidate.adapterId === adapterId));
			if (entry === undefined || session.task()?.kind !== entry.taskKind ||
				contributedTaskOwner?.adapterId !== entry.adapterId || contributedTaskOwner.taskId !== entry.id) return null;
			try {
				const content = adapters.get(entry.adapterId)?.contributions.instrument?.({
					kind: entry.taskKind, targetRef: entry.targetRef ?? null
				}) ?? null;
				if (!content?.view) return content;
				const services = content.view.services;
				// **TD-8.** These services belong to the *contributed task instance*, not to
				// a writer generation. A generation is bumped by every task lifecycle
				// change (open, close, resume, lens change, accepted install), so
				// capturing it here made a mounted panel keep a value that was stale by
				// design: after Undo/Redo the next `Begin` refused `stale-epoch`. The
				// lifetime the instrument actually needs is the task object it was opened
				// for: the same open task means the same authority, a replacement, reopen,
				// Resume, close or install is a different (or absent) task and refuses.
				// The facade already refuses each operation after those transitions, and a
				// closed task is announced synchronously (see `installAccepted`), so the
				// panel rebuilds instead of holding services that can no longer act.
				// Nothing here re-acquires host internals; the panel keeps what it was
				// handed.
				const openedFor = session.task();
				const taskOwner = { adapterId: entry.adapterId, taskId: entry.id };
				const active = () =>
					openedFor !== null &&
					isLive() &&
					session.task() === openedFor &&
					contributedTaskOwner?.adapterId === taskOwner.adapterId &&
					contributedTaskOwner.taskId === taskOwner.taskId;
				return { ...content, view: { ...content.view, services: {
					stage: { ...services.stage,
						setSelection: (value) => active() ? setSelection(value) : { kind: 'refused', code: 'inactive-task', message: 'Resume the task before selecting.' },
						select: (value) => { if (active()) select(value); },
						acquireGesture: (request) => active() ? facade.acquireGesture(request) : { kind: 'refused', code: 'stale-epoch', owner: request.owner }
					},
					authoring: { ...services.authoring, accept: (intent) => active() ? services.authoring.accept(intent) : Promise.resolve({ kind: 'refused', code: 'inactive-task', message: 'Resume the task before applying a proposal.' }) }
				} } };
			} catch { return null; }
		},
		openFindEntry(adapterId, id) {
			ensureBindings();
			const entry = contributions.findEntriesOf().find((candidate) => candidate.id === id && candidate.adapterId === adapterId);
			const tasks = contributions.tasksOf().filter((candidate) => candidate.adapterId === adapterId && candidate.taskKind === entry?.taskKind);
			if (tasks.length !== 1) return { kind: 'refused', code: 'unknown-task', message: 'Find requires one task of the declared kind in its owning adapter' };
			entry?.onInvoke?.();
			return facade.openContributedTask(tasks[0]!.id, adapterId);
		},
		openContributedTask(id, adapterId) {
			if (!isLive()) {
				return { kind: 'refused', code: 'task-closed', message: 'the stage is disposed and opens no task' };
			}
			ensureBindings();
			const entry = contributions.tasksOf().find((candidate) => candidate.id === id && (adapterId === undefined || candidate.adapterId === adapterId));
			if (entry === undefined) {
				return { kind: 'refused', code: 'unknown-task', message: `no adapter contributes a task "${id}"` };
			}
			const lens = entry.lens ?? 'world';
			if (lens !== session.lens()) {
				// A lens-bound operation is not a disposed session: name the lens, so the
				// creator returns there instead of reading "disposed" for a live Stage.
				return { kind: 'refused', code: 'wrong-lens', message: `Return to the ${lens} lens before invoking ${entry.label}.` };
			}
			// Opening a task ends the no-task surface too: a direct-manipulation gesture
			// (a size ray) must not outlive the task that now owns the pointer. A
			// replacement also closes its previous contributed task through the same
			// taskClosed path as Esc, so no lease survives into the new task.
			if (contributedTaskOwner === null ||
				contributedTaskOwner.adapterId !== entry.adapterId || contributedTaskOwner.taskId !== entry.id) {
				notifyTaskClosed();
			}
			const task: StageTask = {
				kind: entry.taskKind,
				label: entry.label,
				targetRef: entry.targetRef ?? null, target: entry.target ?? null, configuration: entry.configuration ?? null, lens
			};
			if (!session.openTask(task)) {
				return { kind: 'refused', code: 'task-closed', message: 'the session is disposed and opens no task' };
			}
			contributedTaskOwner = { adapterId: entry.adapterId, taskId: entry.id };
			notifyAdaptersChanged();
			const instrument = facade.instrumentForTask(id, entry.adapterId);
			return { kind: 'opened', taskId: entry.id, task, adapterId: entry.adapterId, instrument };
		},
		subjects: contributions.subjects,
		findEntries: contributions.findEntries,
		cardFacts: contributions.cardFacts,
		pointerIntent(intent) {
			if (!isLive()) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			if (intent.phase === 'down') {
				// Only the binding whose task owns the surface may claim the press: a
				// different adapter's pointer hook cannot take another task's gesture.
				const taskOwner = contributedTaskOwner;
				if (taskOwner !== null) {
					const entry = adapters.get(taskOwner.adapterId);
					const claim = entry?.contributions.pointerIntent;
					if (claim === undefined) return { claimed: false, adapterId: null };
					try {
						if (claim(intent, handle.context)) {
							pointerOwner = taskOwner.adapterId;
							return { claimed: true, adapterId: taskOwner.adapterId };
						}
					} catch {
						// A throwing claim is a refusal, not a stolen press.
					}
					return { claimed: false, adapterId: null };
				}
				// Direct manipulation belongs only to the primary selection's domain.
				const admittedMark = intent.handleId === undefined
					? undefined
					: contributions.stageMarks().find((mark) =>
						mark.id === intent.handleId &&
						(intent.handleAdapterId === undefined || mark.adapterId === intent.handleAdapterId)
					);
				if (intent.handleId !== undefined && admittedMark === undefined) {
					return { claimed: false, adapterId: null };
				}
				const adapterId = admittedMark?.adapterId ?? primaryEntry(session.selectionState())?.reference.domain;
				const entry = adapterId === undefined ? undefined : adapters.get(adapterId);
				const claim = entry?.contributions.pressWhenNoTask === true ? entry.contributions.pointerIntent : undefined;
				if (claim !== undefined) {
					try {
						if (claim(intent, handle.context)) {
							pointerOwner = adapterId!;
							if (intent.handleId !== undefined) {
								contributions.setActiveMark({ adapterId: adapterId!, id: intent.handleId });
							}
							return { claimed: true, adapterId: adapterId! };
						}
					} catch {
						// A throwing claim is a refusal, not a stolen press.
					}
				}
				return { claimed: false, adapterId: null };
			}
			const owner = pointerOwner;
			if (owner === null) {
				if (intent.phase === 'move') facade.hoverIntent(intent);
				return { claimed: false, adapterId: null };
			}
			const entry = adapters.get(owner);
			if (entry === undefined) {
				pointerOwner = null;
				return { claimed: false, adapterId: null };
			}
			try { entry.contributions.pointerIntent?.(intent, handle.context); } catch { /* Subscriber isolation. */ }
			if (intent.phase !== 'move') {
				// A writer that deliberately kept its gesture lease (numeric entry after
				// pointer-up) also keeps the keyboard until Enter or Esc. A writer that
				// released has ended, so the host drops ownership with it.
				if (session.gesture() === null) {
					pointerOwner = null;
					contributions.setActiveMark(null);
				}
			}
			return { claimed: true, adapterId: owner };
		},
		hoverIntent(intent) {
			if (!isLive() || session.gesture() !== null || contributedTaskOwner === null) return false;
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return false;
			try { return adapters.get(contributedTaskOwner.adapterId)?.contributions.hoverIntent?.(intent, handle.context) === true; }
			catch { return false; }
		},
		keyboardIntent(intent) {
			if (!isLive()) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			// Only the binding that owns the open task answers a command key: another
			// adapter's hook must not command work it does not own.
			const taskOwner = contributedTaskOwner;
			if (taskOwner === null) return { claimed: false, adapterId: null };
			const entry = adapters.get(taskOwner.adapterId);
			const claim = entry?.contributions.keyIntent;
			if (claim === undefined) return { claimed: false, adapterId: null };
			try {
				if (claim(intent, handle.context)) {
					return { claimed: true, adapterId: taskOwner.adapterId };
				}
			} catch {
				// A throwing claim is a refusal, never a stolen key.
			}
			return { claimed: false, adapterId: null };
		},
		gestureKeyIntent(intent) {
			if (!isLive() || session.task() !== null) return { claimed: false, adapterId: null };
			const owner = pointerOwner;
			if (owner === null) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			const claim = adapters.get(owner)?.contributions.keyIntent;
			if (claim === undefined) return { claimed: false, adapterId: null };
			try {
				return claim(intent, handle.context)
					? { claimed: true, adapterId: owner }
					: { claimed: false, adapterId: null };
			} catch {
				return { claimed: false, adapterId: null };
			}
		},
		selectionKeyIntent(intent) {
			// This is the **unowned** key path: an open task or a live press has already
			// been offered the key and owns it first. Asking adapters underneath either
			// one would let a selection shortcut compete with an active writer.
			if (!isLive() || session.task() !== null || session.gesture() !== null) {
				return { claimed: false, adapterId: null };
			}
			if (pointerOwner !== null) return { claimed: false, adapterId: null };
			ensureBindings();
			const handle = adapterContext();
			if (handle === null) return { claimed: false, adapterId: null };
			// Deterministic adapter order, exactly like `cardWriter`: each adapter's
			// `keyIntent` checks its own selection and returns `false` when the key has
			// no scoped meaning, so only the selected subject can claim it.
			const ids = [...adapters.keys()].sort();
			for (const adapterId of ids) {
				const claim = adapters.get(adapterId)?.contributions.keyIntent;
				if (claim === undefined) continue;
				try {
					if (claim(intent, handle.context)) return { claimed: true, adapterId };
				} catch {
					// A throwing claim is a refusal, never a stolen key.
				}
			}
			return { claimed: false, adapterId: null };
		},
		notifySurfaceChange() {
			if (isLive()) notifyAdaptersChanged();
		},
		cardWriter: contributions.cardWriter,
		cardActions: contributions.cardActions,
		cardNameWriter: contributions.cardNameWriter,
		acquireGesture(request) {
			if (!isLive()) return { kind: 'refused', code: 'stale-epoch', owner: request.owner };
			const outcome = session.acquireGesture({
				owner: request.owner,
				evaluationId: request.evaluationId,
				acceptedRevision: currentSnapshot.acceptedRevision,
				policy: request.policy,
				...(request.navigation === true ? { navigation: true } : {})
			});
			// **Never notify adapter listeners here.** A lease is not a registration or
			// a binding change: a granted proposal changes what Undo reports, but the
			// host reads that on its own refresh frame. Notifying invalidated every
			// contribution view, which rebuilt the instrument that had just acquired
			// the lease, disposing it and releasing the proposal on the same keystroke —
			// so Undo could never actually observe `live-proposal`.
			return outcome;
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (session.isCurrent(lifetimeToken) && contributedTaskOwner !== null) session.closeTask();
			contributedTaskOwner = null;
			bindings.dispose();
			planCutUnsubscribe?.();
			planCutUnsubscribe = null;
		}
	};

	// The one v1 consumer of the height fact. Registration is at mount, the
	// current height is pushed immediately (a recreated facade must not disagree
	// with the session), and the existing Plan-override path remains the only
	// parameter authority. The Sheet never imports this consumer.
	planCutUnsubscribe = session.heightSheet().subscribe('plan-cut', (heightMeters) => {
		facade.setPlanParameters({ cutHeightMeters: heightMeters });
	});
	facade.setPlanParameters({ cutHeightMeters: session.heightSheet().height() });

	return facade;
}
