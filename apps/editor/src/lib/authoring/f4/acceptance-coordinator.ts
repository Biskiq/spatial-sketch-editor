import { createPlannerRegistry, prepareIntent, sameRevision, immutableF4Data, freezeF4Data, validateAuthoringIntent, validateAcceptedRevision } from '@portfolio/project-model';
import type {
	AcceptanceRejection,
	AcceptanceRejectionCode,
	AcceptanceResult,
	AcceptanceSourceAdapter,
	AcceptedRevision,
	AcceptedSnapshot,
	AdmissionIssue,
	AdmittedSource,
	AuthoringIntent,
	CapturedInput,
	CorrespondenceEntry,
	DomainPlanner,
	RegistrationOutcome,
	SessionEpoch,
	ShapeIssue,
	SourceAdmission,
	PlannerRegistry,
	PrepareResult
} from '@portfolio/project-model';
import { AUTHORING_HISTORY_LIMIT, AuthoringHistory, type HistoryState } from './history';

/** One admitted source the coordinator starts from, or replaces with. */
export type AcceptanceBaseline<Source> = {
	readonly revision: AcceptedRevision;
	readonly source: Source;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
	readonly blockingIssues?: readonly AdmissionIssue[];
	/** The operation that produced this baseline; defaults to the boot identity. */
	readonly operationId?: string;
};

export type AcceptanceCoordinatorOptions<Source> = {
	/** The admission/content-identity seam (the current-source adapter, or a test double). */
	readonly adapter: AcceptanceSourceAdapter<Source>;
	readonly sessionEpoch: SessionEpoch;
	readonly baseline: AcceptanceBaseline<Source>;
	/** Planners to register up front; refusals are reported, never thrown. */
	readonly planners?: readonly DomainPlanner<Source>[];
	/** Future source admission can extend preparation without replacing lifecycle/history. */
	readonly preparation?: {
		readonly registry: PlannerRegistry<Source>;
		prepare(snapshot: AcceptedSnapshot<Source>, intent: AuthoringIntent, capturedInputs?: readonly CapturedInput[]): PrepareResult<Source>;
	};
	/** Deterministic in tests; production uses an opaque UUID outside planning. */
	readonly mintRevisionId?: (ordinal: number) => string;
};

/** What a project replacement did: one new baseline, or the adapter's refusal. */
export type ReplaceOutcome =
	| { readonly kind: 'replaced'; readonly revision: AcceptedRevision; readonly sourceContentId: string }
	| {
			readonly kind: 'refused';
			readonly code: string;
			readonly message: string;
			readonly issues: readonly ShapeIssue[];
	  };

/** What an Undo or Redo did: one restored state, or nothing to restore. */
export type HistoryOutcome<Source> =
	| {
			readonly kind: 'restored';
			readonly direction: 'undo' | 'redo';
			readonly beforeRevision: AcceptedRevision;
			readonly afterRevision: AcceptedRevision;
			readonly snapshot: AcceptedSnapshot<Source>;
			/** The content identity restored — identical to the state it restores. */
			readonly restoredContentId: string;
			readonly correspondence: readonly CorrespondenceEntry[];
	  }
	| {
			readonly kind: 'unavailable';
			readonly direction: 'undo' | 'redo';
			readonly revision: AcceptedRevision;
	  }
	| { readonly kind: 'refused'; readonly direction: 'undo' | 'redo'; readonly code: AcceptanceRejectionCode; readonly message: string; readonly diagnostics: readonly ShapeIssue[] };

export type AcceptanceCoordinator<Source> = {
	readonly sourceKind: string;
	readonly sourceVersion: number;
	sessionEpoch(): SessionEpoch;
	acceptedRevision(): AcceptedRevision;
	acceptedSnapshot(): AcceptedSnapshot<Source>;
	current(): AdmittedSource<Source>;
	/** Published revisions so far, including the baseline and any replacement. */
	installs(): number;
	register(planner: DomainPlanner<Source>): RegistrationOutcome;
	planners(): readonly DomainPlanner<Source>[];
	/** Registration refusals this provider reported (compound, unit, resource, duplicate). */
	registrationRefusals(): readonly { readonly reason: string; readonly message: string }[];
	accept(intent: AuthoringIntent, capturedInputs?: readonly CapturedInput[]): Promise<AcceptanceResult<Source>>;
	undo(): Promise<HistoryOutcome<Source>>;
	redo(): Promise<HistoryOutcome<Source>>;
	history(): { readonly depth: number; readonly position: number; readonly limit: number };
	canUndo(): boolean;
	canRedo(): boolean;
	/**
	 * Project replacement: admit the new source through the same adapter, then start
	 * a fresh baseline under a fresh session epoch. There is no direct-install
	 * bypass — a replacement is validated like any other source, and it is the one
	 * path that moves the epoch, which is what invalidates in-flight completions
	 * from the project being replaced.
	 */
	replace(next: { readonly revision: AcceptedRevision; readonly source: unknown; readonly sessionEpoch?: SessionEpoch }): Promise<ReplaceOutcome>;
};

/**
 * Editor-only serialized acceptance. Every async completion rechecks an internal
 * lifetime generation and exact revision before one immutable install. History
 * restoration uses the same adapter and commits its cursor only after admission.
 */
export function createAcceptanceCoordinator<Source>(
	options: AcceptanceCoordinatorOptions<Source>
): AcceptanceCoordinator<Source> {
	const adapter = Object.freeze({ ...options.adapter });
	const registry = options.preparation?.registry ?? createPlannerRegistry<Source>();
	const prepare = options.preparation?.prepare.bind(options.preparation) ??
		((snapshot: AcceptedSnapshot<Source>, intent: AuthoringIntent, inputs?: readonly CapturedInput[]) => prepareIntent(registry, snapshot, intent, inputs));
	const refusals: { reason: string; message: string }[] = [];
	function register(planner: DomainPlanner<Source>): RegistrationOutcome {
		const outcome = registry.register(planner);
		if (outcome.kind === 'refused') refusals.push({ reason: outcome.reason, message: outcome.message });
		return outcome;
	}
	for (const planner of options.planners ?? []) register(planner);
	const mint = options.mintRevisionId ?? (() => crypto.randomUUID());
	let epoch = options.sessionEpoch;
	let generation = 0;
	let replacing = false;
	let ordinal = 0;
	let installs = 1;
	let current: AdmittedSource<Source> = immutableF4Data({
		...options.baseline,
		blockingIssues: options.baseline.blockingIssues ?? [],
		operationId: options.baseline.operationId ?? 'session-boot',
		correspondence: []
	});
	const seenRevisions = new Set([revisionKey(current.revision)]);
	const seenEpochs = new Set([epoch]);
	const history = new AuthoringHistory<Source>(stateOf(current), AUTHORING_HISTORY_LIMIT);

	function snapshotOf(admitted: AdmittedSource<Source>): AcceptedSnapshot<Source> {
		return freezeF4Data({
			acceptedRevision: admitted.revision, sourceContentId: admitted.sourceContentId,
			sourceKind: adapter.sourceKind, sourceVersion: adapter.sourceVersion,
			domain: { identity: { acceptedRevision: admitted.revision, sourceContentId: admitted.sourceContentId }, source: admitted.source }
		});
	}
	function rejection(intent: AuthoringIntent, code: AcceptanceRejectionCode, reason: string | null, message: string, diagnostics: readonly ShapeIssue[] = [], actualRevision: AcceptedRevision | null = current.revision): AcceptanceRejection {
		return freezeF4Data({ kind: 'rejected', operationId: intent.operationId, code, reason, message, expectedRevision: intent.expectedRevision, actualRevision, diagnostics });
	}
	function freshRevision(): AcceptedRevision | null {
		try {
			const next = { projectId: current.revision.projectId, revisionId: mint(++ordinal) };
			return validateAcceptedRevision(next).success && !seenRevisions.has(revisionKey(next)) ? freezeF4Data(next) : null;
		} catch { return null; }
	}
	function install(state: HistoryState<Source>, revision: AcceptedRevision, record: boolean): AdmittedSource<Source> {
		current = freezeF4Data({ ...state, revision });
		seenRevisions.add(revisionKey(revision));
		if (record) history.push(stateOf(current));
		installs += 1;
		return current;
	}
	async function admit(source: unknown, issues: readonly AdmissionIssue[]): Promise<SourceAdmission<Source>> {
		try { return await adapter.admit(source, issues); } catch (error) {
			return { kind: 'rejected', code: 'admission-failed', message: error instanceof Error ? error.message : 'Source admission failed', issues: [] };
		}
	}
	function historyRefusal(direction: 'undo' | 'redo', code: AcceptanceRejectionCode, message: string, diagnostics: readonly ShapeIssue[] = []): HistoryOutcome<Source> {
		return { kind: 'refused', direction, code, message, diagnostics };
	}
	async function restore(direction: 'undo' | 'redo'): Promise<HistoryOutcome<Source>> {
		if (replacing) return historyRefusal(direction, 'superseded-epoch', 'Project replacement is in progress');
		const state = history.peek(direction);
		if (!state) return { kind: 'unavailable', direction, revision: current.revision };
		const before = current;
		const requestGeneration = generation;
		const admission = await admit(state.source, before.blockingIssues);
		if (generation !== requestGeneration) return historyRefusal(direction, 'superseded-epoch', 'The session was replaced');
		if (!sameRevision(current.revision, before.revision)) return historyRefusal(direction, 'stale-revision', 'The accepted revision moved during restoration');
		if (admission.kind === 'rejected') return historyRefusal(direction, 'admission-refused', admission.message, admission.issues);
		if (admission.canonicalJson !== state.canonicalJson || admission.sourceContentId !== state.sourceContentId) return historyRefusal(direction, 'admission-refused', 'Restoration must preserve the exact recorded source');
		const revision = freshRevision();
		if (!revision) return historyRefusal(direction, 'admission-refused', 'Revision mint must return a fresh valid identity');
		const correspondence = direction === 'redo' ? state.correspondence : before.correspondence.map(invertCorrespondence);
		const after = install(state, revision, false);
		if (direction === 'undo') history.undo(); else history.redo();
		return freezeF4Data({ kind: 'restored', direction, beforeRevision: before.revision, afterRevision: after.revision, snapshot: snapshotOf(after), restoredContentId: state.sourceContentId,
			correspondence: qualifyCorrespondence(correspondence, before.sourceContentId, after.sourceContentId) });
	}

	return {
		sourceKind: adapter.sourceKind, sourceVersion: adapter.sourceVersion,
		sessionEpoch: () => epoch, acceptedRevision: () => current.revision,
		acceptedSnapshot: () => snapshotOf(current), current: () => current,
		installs: () => installs, register, planners: () => registry.planners(),
		registrationRefusals: () => immutableF4Data(refusals),
		async accept(input, capturedInputs) {
			let validation = validateAuthoringIntent(input);
			if (validation.success && capturedInputs !== undefined) validation = validateAuthoringIntent({ ...validation.value, capturedInputs });
			if (!validation.success) return { kind: 'rejected', operationId: '', code: 'invalid-intent', reason: null, message: 'Intent must be deterministic AuthoringIntent@1 data', expectedRevision: null, actualRevision: null, diagnostics: validation.issues };
			const intent = validation.value;
			if (replacing) return rejection(intent, 'superseded-epoch', null, 'Project replacement is in progress', [], null);
			const requestGeneration = generation;
			const before = current;
			if (!registry.plannerFor(intent.kind)) return rejection(intent, 'unsupported-operation', null, 'The operation has no registered planner', [], null);
			if (!sameRevision(before.revision, intent.expectedRevision)) return rejection(intent, 'stale-revision', null, 'The expected accepted revision is stale');
			let prepared: PrepareResult<Source>;
			try { prepared = prepare(snapshotOf(before), intent, intent.capturedInputs); } catch (error) {
				return rejection(intent, 'planner-rejected', 'planner-failed', error instanceof Error ? error.message : 'Planner failed');
			}
			if (prepared.kind === 'refused') {
				if (prepared.reason === 'no_op') return { kind: 'no-op', operationId: intent.operationId, revision: current.revision };
				return rejection(intent, prepared.code, prepared.reason, prepared.message, prepared.diagnostics,
					prepared.code === 'stale-revision' || prepared.code === 'planner-rejected' ? current.revision : null);
			}
			let candidate;
			try { candidate = immutableF4Data(prepared.candidate); } catch {
				return rejection(intent, 'planner-rejected', 'invalid-candidate', 'Candidate must be capturable data');
			}
			if (candidate.operationId !== intent.operationId || candidate.sourceKind !== adapter.sourceKind || candidate.sourceVersion !== adapter.sourceVersion) return rejection(intent, 'planner-rejected', 'invalid-candidate', 'Candidate must describe this operation and source format');
			const admission = await admit(candidate.source, before.blockingIssues);
			if (generation !== requestGeneration) return rejection(intent, 'superseded-epoch', null, 'The session was replaced during preparation', [], null);
			if (!sameRevision(current.revision, before.revision)) return rejection(intent, 'stale-revision', null, 'The accepted revision moved during preparation');
			if (admission.kind === 'rejected') return rejection(intent, 'admission-refused', admission.code, admission.message, admission.issues);
			const planner = registry.plannerFor(intent.kind);
			if (!planner) return rejection(intent, 'unsupported-operation', null, 'The operation has no registered planner', [], null);
			let scopeIssues: readonly ShapeIssue[];
			try { scopeIssues = adapter.validateChange?.(before.source, admission.source, planner.admission.domain) ?? []; } catch {
				return rejection(intent, 'admission-refused', 'scope-check-failed', 'Candidate scope validation failed');
			}
			if (scopeIssues.length) return rejection(intent, 'admission-refused', 'unsupported-change', 'Candidate changes contents outside its admitted domain', scopeIssues);
			if (admission.sourceContentId === before.sourceContentId) return { kind: 'no-op', operationId: intent.operationId, revision: current.revision };
			const revision = freshRevision();
			if (!revision) return rejection(intent, 'admission-refused', 'reused-revision', 'Revision mint must return a fresh valid identity');
			const correspondence = qualifyCorrespondence(candidate.correspondence, before.sourceContentId, admission.sourceContentId);
			const state = immutableF4Data({ source: admission.source, canonicalJson: admission.canonicalJson, sourceContentId: admission.sourceContentId,
				operationId: intent.operationId, blockingIssues: admission.blockingIssues, correspondence });
			const after = install(state, revision, true);
			return freezeF4Data({ kind: 'accepted', operationId: intent.operationId, beforeRevision: before.revision, afterRevision: after.revision,
				snapshot: snapshotOf(after), changes: candidate.changes, correspondence,
				undoResult: history.canUndo() ? { kind: 'undoable', beforeRevision: before.revision, inverseOperationId: intent.operationId } : { kind: 'none' } });
		},
		undo: () => restore('undo'), redo: () => restore('redo'),
		history: () => ({ depth: history.depth, position: history.position, limit: history.limit }),
		canUndo: () => history.canUndo(), canRedo: () => history.canRedo(),
		async replace(input) {
			const requestGeneration = ++generation;
			replacing = true;
			const requestedEpoch = input.sessionEpoch;
			epoch = requestedEpoch && !seenEpochs.has(requestedEpoch) ? requestedEpoch : crypto.randomUUID();
			seenEpochs.add(epoch);
			try {
				const next = immutableF4Data(input);
				if (!validateAcceptedRevision(next.revision).success || seenRevisions.has(revisionKey(next.revision))) return { kind: 'refused', code: 'reused-revision', message: 'Replacement requires a fresh valid revision identity', issues: [] };
				const admission = await admit(next.source, []);
				if (generation !== requestGeneration) return { kind: 'refused', code: 'superseded-epoch', message: 'A newer replacement superseded this source', issues: [] };
				if (admission.kind === 'rejected') return { kind: 'refused', code: admission.code, message: admission.message, issues: admission.issues };
				const state = immutableF4Data({ source: admission.source, canonicalJson: admission.canonicalJson, sourceContentId: admission.sourceContentId,
					blockingIssues: admission.blockingIssues, operationId: 'project-replacement', correspondence: [] });
				install(state, next.revision, false);
				history.replaceBaseline(stateOf(current));
				return { kind: 'replaced', revision: current.revision, sourceContentId: current.sourceContentId };
			} catch (error) {
				return { kind: 'refused', code: 'invalid-source', message: error instanceof Error ? error.message : 'Invalid replacement source', issues: [] };
			} finally {
				if (generation === requestGeneration) replacing = false;
			}
		}
	};
}

function revisionKey(revision: AcceptedRevision): string {
	return JSON.stringify([revision.projectId, revision.revisionId]);
}
function stateOf<Source>(admitted: AdmittedSource<Source>): HistoryState<Source> {
	const { revision: _revision, ...state } = admitted;
	return state;
}
function invertCorrespondence(entry: CorrespondenceEntry): CorrespondenceEntry {
	return { relation: entry.relation === 'created' ? 'retired' : entry.relation === 'retired' ? 'created' : entry.relation, before: entry.after, after: entry.before };
}
function qualifyCorrespondence(entries: readonly CorrespondenceEntry[], beforeId: string, afterId: string): readonly CorrespondenceEntry[] {
	return entries.map((entry) => ({ ...entry,
		before: entry.before && { ...entry.before, revision: { kind: 'exact' as const, contentRevision: beforeId } },
		after: entry.after && { ...entry.after, revision: { kind: 'exact' as const, contentRevision: afterId } }
	}));
}
