/**
 * The host↔F4 wiring (T1.P01.S07).
 *
 * One editor host owns **one** `createAcceptanceCoordinator` per project epoch. The
 * coordinator is the only acceptance writer; this module is the host half that
 * turns its results into Stage transitions:
 *
 * - an accepted install becomes a **content change** through the facade's one
 *   accepted-source slot (same pose, adapter re-binding, Camera output re-acquired);
 * - the live selection is requalified through the change's accepted correspondence;
 * - Undo/Redo are host commands, and unavailability carries a visible reason;
 * - project replacement starts a new coordinator/baseline under a new epoch, and a
 *   completion from the previous epoch cannot install.
 *
 * It owns no history of its own: the coordinator's bounded authoring history is the
 * single stack, and this module never interprets an accepted source.
 */
import {
	createCurrentSourceAdapter,
	type AcceptedRevision,
	type AcceptedSnapshot,
	type AuthoringIntent,
	type CorrespondenceEntry,
	type DomainPlanner,
	type ProjectDocument,
	type RegistrationOutcome
} from '@portfolio/project-model';
import { MUSEUM_SCENE_VALIDATION_OPTIONS } from '$lib/content/scene-validation';

import {
	createAcceptanceCoordinator,
	type AcceptanceCoordinator,
	type HistoryOutcome
} from '$lib/authoring/f4';
import { admitSource, type StageReadSnapshot } from './source-admission';
import type { StageContentInstall, StageFacade } from './stage-facade';
import { requalifySelectionEntry, requalifySelection } from './selection-requalification';
import { sameReference, sameSubject } from './semantic-selection';

/** The baseline one host lifetime starts from; the route already admitted it. */
export type StageAcceptanceBaseline = {
	readonly revision: AcceptedRevision;
	readonly source: ProjectDocument;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
};

export type StageInstalledTransition = Extract<StageContentInstall, { kind: 'installed' }>;

export type StageAcceptOutcome =
	| {
			readonly kind: 'installed';
			readonly install: StageInstalledTransition;
			/** `null` when the selection survived; otherwise why it did not. */
			readonly selectionClearedReason: 'subject-retired' | 'no-correspondence' | null;
	  }
	| { readonly kind: 'unchanged'; readonly sourceContentId: string }
	| { readonly kind: 'no-op'; readonly revision: AcceptedRevision }
	| {
			readonly kind: 'refused';
			readonly code: string;
			readonly message: string;
			/**
			 * What happened to the coordinator step that was committed before the Stage
			 * refused. `failed` means the history could not be rolled back and is therefore
			 * ahead of what is mounted — never silently reported as a plain refusal.
			 */
			readonly compensation?: 'reversed' | 'failed';
	  };

export type StageHistoryDirection = 'undo' | 'redo';

export type StageHistoryCommandOutcome =
	| {
			readonly kind: 'installed';
			readonly direction: StageHistoryDirection;
			readonly install: StageInstalledTransition;
			readonly selectionClearedReason: 'subject-retired' | 'no-correspondence' | null;
	  }
	| {
			readonly kind: 'unchanged';
			readonly direction: StageHistoryDirection;
			readonly sourceContentId: string;
	  }
	| {
			readonly kind: 'unavailable';
			readonly direction: StageHistoryDirection;
			readonly reason: 'empty-stack' | 'live-proposal';
	  }
	| {
			readonly kind: 'refused';
			readonly direction: StageHistoryDirection;
			readonly code: string;
			readonly message: string;
			readonly compensation?: 'reversed' | 'failed';
	  };

export type StageHistoryState = {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly depth: number;
	readonly position: number;
	/** Why Undo is unavailable, or `null` when it is live. Never a silent dead button. */
	readonly undoUnavailableReason: string | null;
	readonly redoUnavailableReason: string | null;
};

export type StageReplacementOutcome =
	| { readonly kind: 'replaced'; readonly snapshot: StageReadSnapshot }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string };

export type StageAcceptanceHost = {
	readonly sessionEpoch: string;
	acceptedRevision(): AcceptedRevision;
	/** The single bounded authoring history, with its own availability reasons. */
	history(): StageHistoryState;
	/**
	 * The domain-neutral registration port.
	 *
	 * A planner registered here is not handed the source at registration, and
	 * dispatch (`prepareIntent`) refuses a planner whose declared
	 * `sourceKinds`/`sourceVersions` do not name the admitted snapshot before it
	 * is ever called. `sourceKind`/`sourceVersion` on this host are the one source
	 * slot's, so a planner that names that encoding is a current-format planner by
	 * contract; `currentStagePlanner` is the explicit adapter that says so for a
	 * planner written against the typed source.
	 */
	registerPlanner(planner: DomainPlanner<unknown>): RegistrationOutcome;
	onChanged(listener: () => void): () => void;
	accept(intent: AuthoringIntent): Promise<StageAcceptOutcome>;
	undo(): Promise<StageHistoryCommandOutcome>;
	redo(): Promise<StageHistoryCommandOutcome>;
	/**
	 * Project replacement: a new admitted baseline under a new epoch. The host that
	 * performed the replacement installs nothing afterwards; the route mounts the
	 * returned snapshot with a fresh host.
	 */
	replace(input: {
		readonly source: unknown;
		readonly revision: AcceptedRevision;
		readonly sessionEpoch: string;
	}): Promise<StageReplacementOutcome>;
	/** The coordinator itself, for wiring evidence and registration refusals. */
	coordinator(): AcceptanceCoordinator<ProjectDocument>;
	dispose(): void;
};

export function createStageAcceptanceHost(options: {
	readonly facade: StageFacade;
	readonly baseline: StageAcceptanceBaseline;
	readonly sessionEpoch: string;
	/** Test-only conformance planners; production registers none until S04. */
	readonly planners?: readonly DomainPlanner<ProjectDocument>[];
}): StageAcceptanceHost {
	const { facade, baseline } = options;
	const sessionEpoch = options.sessionEpoch;
	const coordinator = createAcceptanceCoordinator<ProjectDocument>({
		adapter: createCurrentSourceAdapter({ scene: MUSEUM_SCENE_VALIDATION_OPTIONS }),
		sessionEpoch,
		baseline: {
			revision: baseline.revision,
			source: baseline.source,
			canonicalJson: baseline.canonicalJson,
			sourceContentId: baseline.sourceContentId
		},
		planners: options.planners ?? []
	});

	let disposed = false;
	const listeners = new Set<() => void>();
	const changed = () => {
		for (const listener of listeners) {
			try { listener(); } catch { /* A view subscriber cannot abort acceptance. */ }
		}
	};
	/** Accepts in flight: a live proposal is why Undo is temporarily unavailable. */
	let inFlight = 0;
	const LIVE_PROPOSAL_REASON = 'A proposal is live; Undo is available once it is accepted or refused.';

	/**
	 * Put the coordinator back where it was after a Stage install refusal.
	 *
	 * The coordinator commits its revision and history cursor before this module
	 * re-admits and installs into the Stage. A refusal that is *not* a lifetime
	 * refusal (a divergent project, an admission refusal, blocking diagnostics) would
	 * otherwise leave the history describing a state that was never mounted, so the
	 * committed step is reversed here. A `superseded-epoch`/`stale-session` refusal
	 * is exempt: that host lifetime is being discarded, so there is nothing to keep
	 * in step with.
	 */
	async function compensate(direction: 'accept' | StageHistoryDirection): Promise<'reversed' | 'failed'> {
		// An accepted step is reversed by Undo; a restored step by the opposite
		// restoration (Undo → Redo, Redo → Undo), so the cursor returns to the state
		// the Stage is still showing.
		const back: StageHistoryDirection =
			direction === 'accept' ? 'undo' : direction === 'undo' ? 'redo' : 'undo';
		try {
			const outcome = back === 'undo' ? await coordinator.undo() : await coordinator.redo();
			// A refusal or an unusable outcome means the coordinator stayed ahead of the
			// mounted Stage; that is reported, not swallowed.
			return outcome.kind === 'restored' ? 'reversed' : 'failed';
		} catch {
			return 'failed';
		}
	}

	function needsCompensation(code: string): boolean {
		return code !== 'superseded-epoch' && code !== 'stale-session';
	}

	async function install(
		snapshot: AcceptedSnapshot<ProjectDocument>,
		correspondence: readonly CorrespondenceEntry[]
	): Promise<StageAcceptOutcome> {
		if (disposed) {
			return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime has ended' };
		}
		if (snapshot.acceptedRevision.projectId !== facade.snapshot().acceptedRevision.projectId) {
			return {
				kind: 'refused',
				code: 'different-project',
				message: 'an accepted source for another project is a replacement, not a content change'
			};
		}
		// One admission path: the accepted source is re-admitted through the same
		// canonical validation, compile and Scene resolution the boot uses, so the
		// Stage never shows a snapshot the visitor runtime could not prepare.
		const admission = await admitSource(snapshot.domain.source, {
			sessionEpoch,
			acceptedRevision: snapshot.acceptedRevision
		});
		if (admission.kind === 'refused') {
			return { kind: 'refused', code: admission.reason, message: 'the accepted source was refused by the admission path' };
		}
		if (admission.kind === 'diagnostics') {
			return { kind: 'refused', code: 'diagnostics', message: 'the accepted source has blocking canonical-compile issues' };
		}
		if (disposed) {
			return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime ended during admission' };
		}
		if (admission.snapshot.sessionEpoch !== sessionEpoch) {
			return { kind: 'refused', code: 'stale-session', message: 'the snapshot belongs to another host lifetime' };
		}
		// The reason is about the *primary* the creator was working on, not about
		// whether anything survived: losing the primary is what the notice describes.
		const beforePrimary = facade.selectionState().primary;
		const installed = facade.installAccepted(admission.snapshot, {
			requalifyEntry: (entry) => requalifySelectionEntry(entry, correspondence, admission.snapshot),
			requalify: (selection) => {
				const outcome = requalifySelection(selection, correspondence, {
					generationId: admission.snapshot.compileGeneration
				});
				return outcome.kind === 'requalified' ? outcome.selection : outcome;
			}
		});
		if (installed.kind === 'unchanged') {
			// Identical content: no install, no rebind, and the selection stays exactly
			// where it is. It is reported as its own outcome so a caller never mistakes
			// it for a transition that happened.
			return { kind: 'unchanged', sourceContentId: installed.sourceContentId };
		}
		if (installed.kind === 'refused') {
			// The caller compensates: this helper serves both an accept and a restore,
			// and only the caller knows which committed step must be reversed.
			return { kind: 'refused', code: installed.code, message: installed.message };
		}
		const after = facade.selectionState();
		const primaryLost =
			beforePrimary !== null && !after.ordered.some((entry) => sameSubject(entry.reference, beforePrimary));
		return {
			kind: 'installed',
			install: installed,
			// Reported only for the subject the creator was working on. A surviving
			// entry that was promoted to primary is not "cleared", so its notice stays
			// silent even when another entry was removed.
			selectionClearedReason: primaryLost
				? installed.selectionRemovals.find((removal) => sameReference(removal.reference, beforePrimary))?.reason ??
					(installed.requalification.kind === 'cleared' ? installed.requalification.reason : 'no-correspondence')
				: null
		};
	}

	async function restore(direction: StageHistoryDirection): Promise<StageHistoryCommandOutcome> {
		if (disposed) {
			return { kind: 'refused', direction, code: 'superseded-epoch', message: 'the host lifetime has ended' };
		}
			// The restore below reports its own live-proposal window through the same
			// reason, so a caller that races a second command gets one vocabulary.
		let outcome: HistoryOutcome<ProjectDocument>;
		try {
			outcome = direction === 'undo' ? await coordinator.undo() : await coordinator.redo();
		} catch {
			return { kind: 'refused', direction, code: 'history-unavailable', message: 'the history command failed' };
		}
		if (outcome.kind === 'unavailable') {
			return { kind: 'unavailable', direction, reason: 'empty-stack' };
		}
		if (outcome.kind === 'refused') {
			return { kind: 'refused', direction, code: outcome.code, message: outcome.message };
		}
		const installed = await install(outcome.snapshot, outcome.correspondence);
		if (installed.kind === 'unchanged') {
			return { kind: 'unchanged', direction, sourceContentId: installed.sourceContentId };
		}
		if (installed.kind !== 'installed') {
			const code = installed.kind === 'refused' ? installed.code : 'history-unavailable';
			const compensation = needsCompensation(code) ? await compensate(direction) : undefined;
			return {
				kind: 'refused',
				direction,
				code,
				message: installed.kind === 'refused' ? installed.message : 'the restored state did not install',
				...(compensation === undefined ? {} : { compensation })
			};
		}
		return {
			kind: 'installed',
			direction,
			install: installed.install,
			selectionClearedReason: installed.selectionClearedReason
		};
	}

	async function runHistory(direction: StageHistoryDirection): Promise<StageHistoryCommandOutcome> {
		if (inFlight > 0) return { kind: 'unavailable', direction, reason: 'live-proposal' };
		inFlight += 1;
		// A restore is authoring work like an accept: a lens exit cancels it, and the
		// coordinator's generation check makes the cancellation actually win.
		const unregister = facade.session.writers().register('command', facade.session.token(), () => coordinator.cancelPending());
		changed();
		try { return await restore(direction); }
		finally { unregister(); inFlight -= 1; changed(); }
	}

	return {
		sessionEpoch,
		acceptedRevision: () => coordinator.acceptedRevision(),
		registerPlanner: (planner) => coordinator.register(planner as DomainPlanner<ProjectDocument>),
		onChanged(listener) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		history() {
			const state = coordinator.history();
			// The reported state must agree with what the command will do: while a
			// proposal is live, neither direction can run, whatever the stack holds.
			const live = inFlight > 0;
			const canUndo = !live && coordinator.canUndo();
			const canRedo = !live && coordinator.canRedo();
			return {
				canUndo,
				canRedo,
				depth: state.depth,
				position: state.position,
				undoUnavailableReason: canUndo
					? null
					: live
						? LIVE_PROPOSAL_REASON
						: 'Nothing to undo yet — no change has been accepted.',
				redoUnavailableReason: canRedo ? null : live ? LIVE_PROPOSAL_REASON : 'Nothing to redo.'
			};
		},
		async accept(intent) {
			if (disposed) {
				return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime has ended' };
			}
			if (inFlight > 0) return { kind: 'refused', code: 'live-proposal', message: 'Another host command is live.' };
			inFlight += 1;
			const unregister = facade.session.writers().register('command', facade.session.token(), () => coordinator.cancelPending());
			changed();
			try {
				const result = await coordinator.accept(intent);
				if (result.kind === 'no-op') return { kind: 'no-op', revision: result.revision };
				if (result.kind === 'rejected') return { kind: 'refused', code: result.code, message: result.message };
				const installed = await install(result.snapshot, result.correspondence);
				if (installed.kind === 'refused' && needsCompensation(installed.code)) {
					return { ...installed, compensation: await compensate('accept') };
				}
				return installed;
			} finally {
				unregister();
				inFlight -= 1;
				changed();
			}
		},
		undo: () => runHistory('undo'),
		redo: () => runHistory('redo'),
		async replace(input) {
			if (disposed) {
				return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime has ended' };
			}
			let prepared: StageReadSnapshot | null = null;
			const replaced = await coordinator.replace(input, async (source, nextEpoch) => {
				const admission = await admitSource(source.source, {
					sessionEpoch: nextEpoch,
					acceptedRevision: source.revision
				});
				if (disposed) return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime has ended' };
				if (admission.kind !== 'admitted') return {
					kind: 'refused', code: admission.kind === 'refused' ? admission.reason : 'diagnostics',
					message: 'the replacement source was not admitted'
				};
				prepared = admission.snapshot;
				return { kind: 'valid' };
			});
			if (replaced.kind === 'refused') {
				return { kind: 'refused', code: replaced.code, message: replaced.message };
			}
			// The callback completed before F4 committed. No fallible Stage admission
			// remains after that commit, and a competing replacement cannot publish it.
			if (prepared === null) throw new Error('replacement committed without Stage admission');
			// This host's lifetime ends with the replacement: a completion from the
			// previous epoch can no longer install. The Stage for the old epoch is torn
			// down here rather than left to the caller's remount, so nothing of the
			// replaced lifetime keeps contributing; the route mounts a fresh facade for
			// `snapshot` (disposing twice is idempotent).
			disposed = true;
			listeners.clear();
			facade.dispose();
			return { kind: 'replaced', snapshot: prepared };
		},
		coordinator: () => coordinator,
		dispose() {
			disposed = true;
			listeners.clear();
		}
	};
}
