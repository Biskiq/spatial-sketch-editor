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
	freezeF4Data,
	type AcceptedRevision,
	type AcceptedSnapshot,
	type AuthoringIntent,
	type CorrespondenceEntry,
	type DomainPlanner,
	type RegistrationOutcome
} from '@portfolio/project-model';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';
import {
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	canonicalUnitJson,
	UNIT_ENVELOPE_SOURCE_KIND,
	UNIT_ENVELOPE_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	consumePreparedCowCandidate,
	createLayoutCompileSession,
	ensureLayoutWorldIndex,
	linkClonedCowCandidate,
	recordPassiveCompiledGeometry
} from '@portfolio/layout-core';

import {
	createAcceptanceCoordinator,
	type AcceptanceCoordinator,
	type HistoryOutcome
} from '$lib/authoring/f4';
import { perfResult } from '$lib/platform/perf-marks';
import { admitSource, type StageDomainRead, type StageReadSnapshot } from './source-admission';
import type { StageContentInstall, StageFacade } from './stage-facade';
import { requalifySelectionEntry, requalifySelection } from './selection-requalification';
import { sameReference, sameSubject } from './semantic-selection';
import { attachUnitStageSource, stageLayout } from './unit-stage-source';

/** The baseline one host lifetime starts from; the route already admitted it. */
export type StageAcceptanceBaseline = {
	readonly revision: AcceptedRevision;
	readonly source: ProjectEnvelope;
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
			readonly reason: 'empty-stack' | 'live-proposal' | 'project-action';
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
	/** Freeze authored writes for one confirmed project lifecycle request. */
	beginProjectAction(): { readonly kind: 'locked'; release(): void } | { readonly kind: 'refused'; readonly message: string };
	/** Adopt a server-confirmed project name across the one source/history authority. */
	adoptProjectName(input: { readonly name: string; readonly savedRevision: AcceptedRevision }): Promise<
		| { readonly kind: 'adopted'; readonly snapshot: StageReadSnapshot }
		| { readonly kind: 'unchanged'; readonly snapshot: StageReadSnapshot }
		| { readonly kind: 'refused'; readonly message: string }
	>;
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
	coordinator(): AcceptanceCoordinator<ProjectEnvelope>;
	dispose(): void;
};

export function createStageAcceptanceHost(options: {
	readonly facade: StageFacade;
	readonly baseline: StageAcceptanceBaseline;
	readonly sessionEpoch: string;
	/**
	 * Conformance planners supplied by a caller before adapters mount. The live
	 * Scene adapter registers its own planners through `registerPlanner`; this
	 * option exists so tests can install a planner into the same coordinator.
	 */
	readonly planners?: readonly DomainPlanner<ProjectEnvelope>[];
}): StageAcceptanceHost {
	const { facade, baseline } = options;
	const sessionEpoch = options.sessionEpoch;
	// T1.P02.S06 D.3 (H1) — one incremental compile store for this host lifetime.
	// Every admission after the first reuses the Layout entities the accepted
	// edit did not move, so an accepted Wall edit no longer pays a whole-document
	// compile to prove the other thousand Rooms are unchanged. It is bounded by
	// the document (units for removed entities are released each compile) and it
	// never outlives the host it belongs to.
	const compileSession = createLayoutCompileSession();
	// T2.P02.S02's bounded host contribution: the coordinator that serves this
	// Stage grants resource staging, so the one placement planner that declares it
	// can install a creator model's resource, exact lock and entity together.
	// Per H0's scope, the grant is the host's; each planner still declares its own
	// resource need, and every other Scene planner keeps `resources: false`.
	const registry = createUnitPlannerRegistry<ProjectEnvelope>({ resourceStaging: true });
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		// F.2 unit admission: compound Camera/Experience operations are admitted, and
		// typed-resource staging is granted to a planner that declares it.
		adapter: createUnitAcceptanceAdapter({ compound: true, resourceStaging: true }),
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch, resourceStaging: true }),
		sessionEpoch,
		baseline: {
			revision: baseline.revision,
			source: baseline.source,
			canonicalJson: baseline.canonicalJson,
			sourceContentId: baseline.sourceContentId
		},
		planners: options.planners ?? []
	});

	const admittedByContentId = new Map<
		string,
		{ readonly domain: StageDomainRead; readonly canonicalJson: string }
	>();
	/**
	 * What this cache retains, precisely: one `StageDomainRead` per remembered
	 * content id — the compiled Layout graph, the resolved runtime Scene, the Room
	 * registry and the reference context — which is what lets Undo/Redo reinstall a
	 * historical state without a compile or a digest. `canonicalJson` is the same
	 * immutable string the F4 history state for that revision already holds, so the
	 * marginal cost is the domain, not the bytes.
	 *
	 * The bound is a *count*, not a byte budget: 52 is a history-cache window, and
	 * a history deeper than that recomputes the older restores (correct, slower).
	 * A domain's geometry shares its entities with its neighbours through the
	 * compile session, so entries are not 52 independent documents — but this is
	 * unmeasured, and it is the reason the count is not raised casually.
	 */
	const MAX_ADMITTED_HISTORY_CACHE = 52;
	const rememberAdmittedSnapshot = (snap: StageReadSnapshot): void => {
		const key = `${snap.acceptedRevision.projectId}\0${snap.sourceContentId}`;
		if (!admittedByContentId.has(key) && admittedByContentId.size >= MAX_ADMITTED_HISTORY_CACHE) {
			const oldest = admittedByContentId.keys().next().value;
			if (oldest !== undefined) admittedByContentId.delete(oldest);
		}
		admittedByContentId.set(key, {
			domain: snap.domain,
			canonicalJson: snap.canonicalJson
		});
	};

	const bootSnap = facade.snapshot();
	if (
		bootSnap.sourceKind === UNIT_ENVELOPE_SOURCE_KIND &&
		bootSnap.sourceContentId === baseline.sourceContentId
	) {
		rememberAdmittedSnapshot(bootSnap);
		const facadeLayout = stageLayout(bootSnap);
		const coordLayout = coordinator.acceptedSnapshot().domain.source.units.layout.data;
		ensureLayoutWorldIndex(facadeLayout);
		linkClonedCowCandidate(facadeLayout, coordLayout);
		recordPassiveCompiledGeometry(facadeLayout, bootSnap.domain.geometry, bootSnap.domain.warnings);
		recordPassiveCompiledGeometry(coordLayout, bootSnap.domain.geometry, bootSnap.domain.warnings);
		compileSession.seedFromCompiled(coordLayout);
	}

	let disposed = false;
	const listeners = new Set<() => void>();
	const changed = () => {
		for (const listener of listeners) {
			try { listener(); } catch { /* A view subscriber cannot abort acceptance. */ }
		}
	};
	/** Accepts in flight: a live proposal is why Undo is temporarily unavailable. */
	let inFlight = 0;
	let writesBlocked = false;
	/** Used only when a live command (not a proposal) owns the window. */
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
		snapshot: AcceptedSnapshot<ProjectEnvelope>,
		correspondence: readonly CorrespondenceEntry[],
		installOptions: {
			readonly fromHistory?: boolean;
			readonly knownIdentity?: {
				readonly sourceContentId: string;
				readonly canonicalJson: string;
			};
		} = {}
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
		let admittedSnapshot: StageReadSnapshot;
		const cachedHistory = installOptions.fromHistory
			? admittedByContentId.get(
					`${snapshot.acceptedRevision.projectId}\0${snapshot.sourceContentId}`
				)
			: undefined;
		if (cachedHistory) {
			const generationId = `compile:${snapshot.sourceContentId}`;
			const reboundDomain: StageDomainRead = {
				...cachedHistory.domain,
				references: createUnitReadContext({
					envelope: snapshot.domain.source,
					acceptedRevision: snapshot.acceptedRevision,
					sourceContentId: snapshot.sourceContentId,
					sessionEpoch,
					generationId
				})
			};
			freezeF4Data(reboundDomain);
			admittedSnapshot = attachUnitStageSource(
				{
					acceptedRevision: snapshot.acceptedRevision,
					sourceContentId: snapshot.sourceContentId,
					canonicalJson: cachedHistory.canonicalJson,
					sessionEpoch,
					sourceKind: UNIT_ENVELOPE_SOURCE_KIND,
					sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
					compileGeneration: generationId,
					domain: reboundDomain
				},
				snapshot.domain.source
			);
			linkClonedCowCandidate(
				stageLayout(admittedSnapshot),
				snapshot.domain.source.units.layout.data
			);
			recordPassiveCompiledGeometry(
				snapshot.domain.source.units.layout.data,
				reboundDomain.geometry,
				reboundDomain.warnings
			);
		} else {
			// One admission path: the accepted source is re-admitted through the same
			// canonical validation, compile and Scene resolution the boot uses, so the
			// Stage never shows a snapshot the visitor runtime could not prepare.
			const admission = await admitSource(
				snapshot.domain.source,
				{ sessionEpoch, acceptedRevision: snapshot.acceptedRevision },
				{ compileSession, knownIdentity: installOptions.knownIdentity }
			);
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
			admittedSnapshot = admission.snapshot;
			linkClonedCowCandidate(
				stageLayout(admittedSnapshot),
				snapshot.domain.source.units.layout.data
			);
			recordPassiveCompiledGeometry(
				snapshot.domain.source.units.layout.data,
				admittedSnapshot.domain.geometry,
				admittedSnapshot.domain.warnings
			);
		}
		// The reason is about the *primary* the creator was working on, not about
		// whether anything survived: losing the primary is what the notice describes.
		const beforePrimary = facade.selectionState().primary;
		const installed = facade.installAccepted(admittedSnapshot, {
			requalifyEntry: (entry) => requalifySelectionEntry(entry, correspondence, admittedSnapshot),
			requalify: (selection) => {
				const outcome = requalifySelection(selection, correspondence, {
					generationId: admittedSnapshot.compileGeneration
				});
				return outcome.kind === 'requalified' ? outcome.selection : outcome;
			}
		});
		if (installed.kind === 'unchanged') {
			rememberAdmittedSnapshot(admittedSnapshot);
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
		rememberAdmittedSnapshot(admittedSnapshot);
		// T3.P03.S02: the accepted revision is installed into the Stage here. The
		// performance harness pairs this with the frame that presents it; the input
		// sequence is the drag sample that produced the commit.
		perfResult('accepted-result', { sourceContentId: installed.sourceContentId });
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
		let outcome: HistoryOutcome<ProjectEnvelope>;
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
		const installed = await install(outcome.snapshot, outcome.correspondence, {
			fromHistory: true
		});
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

	/**
	 * Whether authoring work currently owns a pre-commit proposal.
	 *
	 * The **active proposal/lease contract** answers this, never a list of gesture
	 * owner names: a moving pointer drag and a live Wall chain are both proposals,
	 * and a lease that declares itself navigation (the host's own press) is not.
	 * The live reason survives until the proposal is accepted, refused or
	 * cancelled, so Undo names what must settle first.
	 */
	function authoringProposalLive(): boolean {
		return facade.session.liveProposal() !== null;
	}

	async function runHistory(direction: StageHistoryDirection): Promise<StageHistoryCommandOutcome> {
		if (writesBlocked) return { kind: 'unavailable', direction, reason: 'project-action' };
		if (inFlight > 0 || authoringProposalLive()) {
			return { kind: 'unavailable', direction, reason: 'live-proposal' };
		}
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
		registerPlanner: (planner) => coordinator.register(planner as DomainPlanner<ProjectEnvelope>),
		onChanged(listener) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		history() {
			const state = coordinator.history();
			// The reported state must agree with what the command will do: while a
			// proposal is live, neither direction can run, whatever the stack holds.
			const proposal = facade.session.liveProposal();
			const live = inFlight > 0 || proposal !== null;
			// The lease's own reason is the message: it knows whether the creator must
			// finish a chain, cancel a drag or let an in-flight command settle.
			const liveReason = proposal?.reason ?? LIVE_PROPOSAL_REASON;
			const canUndo = !writesBlocked && !live && coordinator.canUndo();
			const canRedo = !writesBlocked && !live && coordinator.canRedo();
			return {
				canUndo,
				canRedo,
				depth: state.depth,
				position: state.position,
				undoUnavailableReason: writesBlocked
					? 'Project rename or deletion is in progress.'
					: canUndo
					? null
					: live
						? liveReason
						: 'Nothing to undo yet — no change has been accepted.',
				redoUnavailableReason: writesBlocked
					? 'Project rename or deletion is in progress.'
					: canRedo ? null : live ? liveReason : 'Nothing to redo.'
			};
		},
		async accept(intent) {
			if (disposed) {
				return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime has ended' };
			}
			if (writesBlocked) return { kind: 'refused', code: 'project-action', message: 'Project rename or deletion is in progress.' };
			if (inFlight > 0) return { kind: 'refused', code: 'live-proposal', message: 'Another host command is live.' };
			const beforeLayout = coordinator.current().source.units.layout.data;
			inFlight += 1;
			const unregister = facade.session.writers().register('command', facade.session.token(), () => coordinator.cancelPending());
			changed();
			try {
				const result = await coordinator.accept(intent);
				if (result.kind === 'no-op') return { kind: 'no-op', revision: result.revision };
				if (result.kind === 'rejected') return { kind: 'refused', code: result.code, message: result.message };
				const preparedCow = consumePreparedCowCandidate(intent.operationId, { baseline: beforeLayout, key: canonicalUnitJson(intent) });
				if (preparedCow) {
					linkClonedCowCandidate(preparedCow, result.snapshot.domain.source.units.layout.data);
				}
				const currentAdmitted = coordinator.current();
				const knownIdentity =
					currentAdmitted.source === result.snapshot.domain.source &&
					currentAdmitted.sourceContentId === result.snapshot.sourceContentId
						? {
								sourceContentId: currentAdmitted.sourceContentId,
								canonicalJson: currentAdmitted.canonicalJson
							}
						: undefined;
				const installed = await install(result.snapshot, result.correspondence, {
					knownIdentity
				});
				if (installed.kind === 'refused' && needsCompensation(installed.code)) {
					return { ...installed, compensation: await compensate('accept') };
				}
				return installed;
			} finally {
				while (consumePreparedCowCandidate(intent.operationId, { baseline: beforeLayout })) { /* release terminal artifacts */ }
				unregister();
				inFlight -= 1;
				changed();
			}
		},
		undo: () => runHistory('undo'),
		redo: () => runHistory('redo'),
		beginProjectAction() {
			if (disposed) return { kind: 'refused', message: 'This project session has ended.' };
			if (writesBlocked) return { kind: 'refused', message: 'Another project action is in progress.' };
			if (inFlight > 0 || authoringProposalLive()) {
				return { kind: 'refused', message: 'Finish or cancel the active edit before renaming or deleting this project.' };
			}
			writesBlocked = true;
			changed();
			let released = false;
			return {
				kind: 'locked',
				release() {
					if (released) return;
					released = true;
					if (disposed) return;
					writesBlocked = false;
					changed();
				}
			};
		},
		async adoptProjectName(input) {
			if (disposed) return { kind: 'refused', message: 'This project session has ended.' };
			if (inFlight > 0 || authoringProposalLive()) {
				return { kind: 'refused', message: 'Finish or cancel the active edit before applying the Cloud project name.' };
			}
			const mounted = facade.snapshot();
			const current = coordinator.current();
			if (input.savedRevision.projectId !== current.revision.projectId || input.name.trim() === '') {
				return { kind: 'refused', message: 'The Cloud project metadata does not match this session.' };
			}
			const rebased = await coordinator.adoptMetadata((source) => ({
				...source,
				name: input.name,
				acceptedRevision: input.savedRevision
			}));
			if (disposed) return { kind: 'refused', message: 'This project session has ended.' };
			if (rebased.kind === 'unchanged') return { kind: 'unchanged', snapshot: mounted };
			if (rebased.kind === 'refused') return { kind: 'refused', message: rebased.message };
			const source = rebased.current.source;
			const snapshot: StageReadSnapshot = attachUnitStageSource({
				...mounted,
				acceptedRevision: rebased.current.revision,
				sourceContentId: rebased.current.sourceContentId,
				canonicalJson: rebased.current.canonicalJson,
				domain: {
					...mounted.domain,
					name: source.name,
					references: createUnitReadContext({
						envelope: source,
						acceptedRevision: rebased.current.revision,
						sourceContentId: rebased.current.sourceContentId,
						sessionEpoch,
						generationId: mounted.compileGeneration
					})
				}
			}, source);
			const installed = facade.adoptMetadata(snapshot);
			if (installed.kind !== 'adopted') return { kind: 'refused', message: installed.kind === 'refused' ? installed.message : 'The Cloud project name was already current.' };
			changed();
			return { kind: 'adopted', snapshot };
		},
		async replace(input) {
			if (disposed) {
				return { kind: 'refused', code: 'superseded-epoch', message: 'the host lifetime has ended' };
			}
			let prepared: StageReadSnapshot | null = null;
			const replaced = await coordinator.replace(input, async (source, nextEpoch) => {
				// A replacement is a different project's document: the store's units are
				// pruned by id and none of them describe this source, so a cold compile is
				// what runs here. It is passed anyway so the store ends up holding the new
				// document rather than the old one.
				const admission = await admitSource(
					source.source,
					{ sessionEpoch: nextEpoch, acceptedRevision: source.revision },
					{ compileSession }
				);
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
			admittedByContentId.clear();
			listeners.clear();
			facade.dispose();
			return { kind: 'replaced', snapshot: prepared };
		},
		coordinator: () => coordinator,
		dispose() {
			disposed = true;
			admittedByContentId.clear();
			listeners.clear();
		}
	};
}
