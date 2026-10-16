/**
 * The editor-only F.4 acceptance coordinator (T1.P01.S03, plan §Scope and
 * §Concurrency and lifetime invariants).
 *
 * One boundary admits registered Layout or Scene planners over the current
 * source: registration → preparation → admission → **one** atomic install with
 * exactly one undo result, published exactly once. The four invariants the plan
 * names are structural here, not aspirational:
 *
 * - **Revision minting is outside planning.** Planning is pure and deterministic
 *   (`prepareIntent`); the coordinator mints the revision from its own ordinal
 *   after admission, so a replay compares *contents* and never ids, and a refused
 *   operation consumes no identity.
 * - **Installation is serialized.** Admission is the only asynchronous step, and
 *   the acceptance context (session epoch, then expected revision) is re-checked
 *   after it, in the same synchronous block that installs. Of two preparations
 *   against one expected revision, whichever resumes first installs and the other
 *   is refused as stale — whatever order their digests complete in.
 * - **The accepted revision is published once.** `accept`/`undo`/`redo`/`replace`
 *   each publish exactly one new revision, after the install is complete; nothing
 *   mutates a published snapshot, and a caller can never observe a half-installed
 *   state.
 * - **Content and revision are different identities.** An Undo back to earlier
 *   contents restores that *content* identity under a **fresh** revision, which is
 *   what lets a Camera output rebase report `unchanged` for restored contents
 *   while an exact F.1 reference keeps resolving.
 *
 * Editor-only on purpose (PR #127 decision 5): the shared AM-4 contracts and the
 * current-source admission live in `@portfolio/project-model` because the
 * public route's module graph includes that package, but this coordinator and its
 * history do not. They are proven unreachable from the public route by
 * `apps/editor/tests/lib/authoring/f4-public-isolation.test.ts`.
 *
 * It builds no Save (that is `T3.P01.S02`), no Stage wiring, no Undo/Redo
 * *commands* and no selection requalification (those are `T1.P01.S04`'s): this
 * slice returns correspondence as data and is provable without the host.
 */

import { createPlannerRegistry, prepareIntent, sameRevision } from '@portfolio/project-model';
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
	DomainPlanner,
	RegistrationOutcome,
	SessionEpoch,
	ShapeIssue,
	SourceAdmission
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
	readonly historyLimit?: number;
	/** Deterministic in tests; the default derives an opaque id from the ordinal. */
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
	  }
	| {
			readonly kind: 'unavailable';
			readonly direction: 'undo' | 'redo';
			readonly revision: AcceptedRevision;
	  };

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
	undo(): HistoryOutcome<Source>;
	redo(): HistoryOutcome<Source>;
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

export function createAcceptanceCoordinator<Source>(
	options: AcceptanceCoordinatorOptions<Source>
): AcceptanceCoordinator<Source> {
	const registry = createPlannerRegistry<Source>();
	const refusals: { reason: string; message: string }[] = [];
	for (const planner of options.planners ?? []) {
		const outcome = registry.register(planner);
		if (outcome.kind === 'refused') refusals.push({ reason: outcome.reason, message: outcome.message });
	}

	const mint = options.mintRevisionId ?? ((ordinal: number) => `accepted-${ordinal}`);
	let epoch: SessionEpoch = options.sessionEpoch;
	let epochOrdinal = 0;
	let revisionOrdinal = 0;
	let installs = 1; // the baseline is one published revision
	let current = admittedFrom(options.baseline);
	const history = new AuthoringHistory<Source>(stateOf(current), options.historyLimit ?? AUTHORING_HISTORY_LIMIT);

	function snapshotOf(admitted: AdmittedSource<Source>): AcceptedSnapshot<Source> {
		return {
			acceptedRevision: admitted.revision,
			sourceContentId: admitted.sourceContentId,
			sourceKind: options.adapter.sourceKind,
			sourceVersion: options.adapter.sourceVersion,
			domain: {
				identity: {
					acceptedRevision: admitted.revision,
					sourceContentId: admitted.sourceContentId
				},
				source: admitted.source
			}
		};
	}

	function rejection(
		intent: AuthoringIntent,
		code: AcceptanceRejectionCode,
		reason: string | null,
		message: string,
		diagnostics: AcceptanceRejection['diagnostics'],
		actualRevision: AcceptedRevision | null
	): AcceptanceRejection {
		return {
			kind: 'rejected',
			operationId: intent.operationId,
			code,
			reason,
			message,
			expectedRevision: intent.expectedRevision,
			actualRevision,
			diagnostics
		};
	}

	/**
	 * One accepted install: mint the revision, publish the state and — only when the
	 * install is a **new** accepted state — record it in the chronological history.
	 * An Undo/Redo *restores* a state the stack already holds, so it moves the
	 * cursor and records nothing: pushing there would truncate the redo branch and
	 * duplicate an entry, which is exactly what a restore is not. Replacement keeps
	 * its own new baseline. Synchronous by construction — no caller can interleave
	 * between the checks and the install.
	 */
	function install(state: HistoryState<Source>, recordHistoryEntry: boolean): AdmittedSource<Source> {
		const admitted: AdmittedSource<Source> = {
			revision: { projectId: current.revision.projectId, revisionId: mint(++revisionOrdinal) },
			source: state.source,
			canonicalJson: state.canonicalJson,
			sourceContentId: state.sourceContentId,
			blockingIssues: state.blockingIssues,
			operationId: state.operationId,
			correspondence: state.correspondence
		};
		current = admitted;
		installs += 1;
		if (recordHistoryEntry) history.push(stateOf(admitted));
		return admitted;
	}

	return {
		sourceKind: options.adapter.sourceKind,
		sourceVersion: options.adapter.sourceVersion,

		sessionEpoch: () => epoch,
		acceptedRevision: () => current.revision,
		acceptedSnapshot: () => snapshotOf(current),
		current: () => current,
		installs: () => installs,

		register(planner) {
			const outcome = registry.register(planner);
			if (outcome.kind === 'refused') refusals.push({ reason: outcome.reason, message: outcome.message });
			return outcome;
		},
		planners: () => registry.planners(),
		registrationRefusals: () => [...refusals],

		async accept(intent, capturedInputs) {
			const requestEpoch = epoch;
			const prepared = prepareIntent(
				registry,
				snapshotOf(current),
				intent,
				capturedInputs ?? intent.capturedInputs
			);
			if (prepared.kind === 'refused') {
				// A planner's own `no_op` is the first-class no-op result: nothing was
				// accepted, so nothing is installed and no history entry appears.
				if (prepared.reason === 'no_op') {
					return { kind: 'no-op', operationId: intent.operationId, revision: current.revision };
				}
				return rejection(
					intent,
					prepared.code,
					prepared.reason,
					prepared.message,
					prepared.diagnostics,
					current.revision
				);
			}

			const candidate = prepared.candidate;
			// The one asynchronous step. Everything after it re-checks the context.
			const admission: SourceAdmission<Source> = await options.adapter.admit(
				candidate.source,
				current.blockingIssues
			);

			if (epoch !== requestEpoch) {
				return rejection(
					intent,
					'superseded-epoch',
					null,
					`the host session epoch moved from "${requestEpoch}" to "${epoch}" while the operation was prepared; this completion cannot install`,
					[],
					null
				);
			}
			if (!sameRevision(current.revision, intent.expectedRevision)) {
				return rejection(
					intent,
					'stale-revision',
					null,
					`the operation answered revision "${intent.expectedRevision.revisionId}" and the accepted revision is now "${current.revision.revisionId}"`,
					[],
					current.revision
				);
			}
			if (admission.kind === 'rejected') {
				return rejection(
					intent,
					'admission-refused',
					admission.code,
					admission.message,
					admission.issues,
					current.revision
				);
			}
			if (admission.sourceContentId === current.sourceContentId) {
				// Identical authored contents: an acceptance would mint a revision for
				// no change and add a history entry that undoes to itself.
				return { kind: 'no-op', operationId: intent.operationId, revision: current.revision };
			}

			// From here to the install there is no `await`: this is the serialized
			// block that makes two preparations against one expected revision resolve
			// to exactly one install and one stale refusal.
			const before = current;
			const after = install(
				{
					source: admission.source,
					canonicalJson: admission.canonicalJson,
					sourceContentId: admission.sourceContentId,
					operationId: intent.operationId,
					blockingIssues: admission.blockingIssues,
					correspondence: candidate.correspondence
				},
				true
			);
			return {
				kind: 'accepted',
				operationId: intent.operationId,
				beforeRevision: before.revision,
				afterRevision: after.revision,
				snapshot: snapshotOf(after),
				changes: candidate.changes,
				correspondence: candidate.correspondence,
				undoResult: history.canUndo()
					? {
							kind: 'undoable',
							beforeRevision: before.revision,
							// The one inverse of this install: restoring the before-state.
							// A domain inverse is never executed, so the accepted operation's
							// own id is the inverse's identity.
							inverseOperationId: intent.operationId
						}
					: { kind: 'none' }
			};
		},

		undo() {
			const state = history.undo();
			if (state === null) {
				return { kind: 'unavailable', direction: 'undo', revision: current.revision };
			}
			const before = current;
			// A fresh revision for the restored content: the state was admitted when
			// it was first installed, so restoration needs no second admission — the
			// host's options and this session's adapter cannot have changed for it.
			const after = install(state, false);
			return {
				kind: 'restored',
				direction: 'undo',
				beforeRevision: before.revision,
				afterRevision: after.revision,
				snapshot: snapshotOf(after),
				restoredContentId: state.sourceContentId
			};
		},

		redo() {
			const state = history.redo();
			if (state === null) {
				return { kind: 'unavailable', direction: 'redo', revision: current.revision };
			}
			const before = current;
			const after = install(state, false);
			return {
				kind: 'restored',
				direction: 'redo',
				beforeRevision: before.revision,
				afterRevision: after.revision,
				snapshot: snapshotOf(after),
				restoredContentId: state.sourceContentId
			};
		},

		history: () => ({ depth: history.depth, position: history.position, limit: history.limit }),
		canUndo: () => history.canUndo(),
		canRedo: () => history.canRedo(),

		async replace(next) {
			// Replacement is a source transition, not an edit. The epoch moves **first**,
			// before the new source is even admitted, so a completion still in flight
			// from the project being replaced can never install. The replacement then
			// goes through the same adapter every other source does: there is no
			// direct-install bypass, and a refused replacement installs nothing.
			// A replacement epoch is derived with its own prefix, so it can never
			// coincide with the session epoch the caller supplied at construction (an
			// equal epoch would let an in-flight completion from the replaced project
			// pass the re-check below).
			epoch = next.sessionEpoch ?? `replacement-${++epochOrdinal}`;
			const requestEpoch = epoch;
			const admission = await options.adapter.admit(next.source, []);
			if (admission.kind === 'rejected') {
				return { kind: 'refused', code: admission.code, message: admission.message, issues: admission.issues };
			}
			if (epoch !== requestEpoch) {
				return {
					kind: 'refused',
					code: 'superseded-epoch',
					message: `a newer session epoch ("${epoch}") replaced this one while the source was admitted`,
					issues: []
				};
			}
			current = {
				revision: next.revision,
				source: admission.source,
				canonicalJson: admission.canonicalJson,
				sourceContentId: admission.sourceContentId,
				blockingIssues: admission.blockingIssues,
				operationId: 'project-replacement',
				correspondence: []
			};
			installs += 1;
			history.replaceBaseline(stateOf(current));
			return { kind: 'replaced', revision: current.revision, sourceContentId: current.sourceContentId };
		}
	};
}

function admittedFrom<Source>(baseline: AcceptanceBaseline<Source>): AdmittedSource<Source> {
	return {
		revision: baseline.revision,
		source: baseline.source,
		canonicalJson: baseline.canonicalJson,
		sourceContentId: baseline.sourceContentId,
		blockingIssues: baseline.blockingIssues ?? [],
		operationId: baseline.operationId ?? 'session-boot',
		correspondence: []
	};
}

function stateOf<Source>(admitted: AdmittedSource<Source>): HistoryState<Source> {
	return {
		source: admitted.source,
		canonicalJson: admitted.canonicalJson,
		sourceContentId: admitted.sourceContentId,
		operationId: admitted.operationId,
		blockingIssues: admitted.blockingIssues,
		correspondence: admitted.correspondence
	};
}