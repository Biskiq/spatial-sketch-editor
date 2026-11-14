/**
 * X1 / decomposition contract P — one route project epoch.
 *
 * This controller owns the composition-lifetime wiring that used to live in the
 * spatial route: it creates the epoch's facade, acceptance host and adapter
 * services, subscribes their notifications, mounts the Save controller, moves
 * Undo/Redo orchestration through the existing acceptance commands, and runs the
 * ordered teardown. It is **not** a second project session, acceptance writer,
 * renderer or history:
 *
 * - `project-session` still owns load/replacement/save protocol;
 * - `StageSession` still owns the replacement epoch, cancellation registry,
 *   selection, task and gesture leases;
 * - `host-acceptance` still owns the one F4 coordinator and its bounded history;
 * - the facade still owns the compiled/presented Stage;
 * - the caller's presentation callbacks still own route view state.
 *
 * **One acceptance/facade pair per admitted epoch.** The baseline order is kept:
 * interrupt old input, replace through the session, reset Preview/focus, dispose
 * the old bindings/facade/acceptance, create and subscribe the new owners, mount
 * Save, then reset presentation. The old contribution subscription is released
 * before its facade is disposed; the old acceptance subscription is released
 * after the new host is created, exactly as the route did.
 *
 * **A stale completion cannot write into a newer epoch.** The acceptance
 * subscription and the history commands compare their captured host with the
 * mounted one and check teardown before touching presentation. Project loads and
 * saves keep their existing guards in project-session; asset completions keep
 * theirs in the asset-lease controller.
 *
 * A `.svelte.ts` controller is created in the route's effect scope. It accepts
 * typed reads/callbacks only; it never imports the route, a domain planner or a
 * renderer store.
 */
import type { StageReadSnapshot } from '../accepted-read';
import type { StageAdapterFactory } from '../stage-adapter-host';
import {
	createStageAdapterServices,
	mountStageAdapter
} from '../stage-adapter-host';
import type { StageFacade } from '../stage-facade';
import {
	createStageAcceptanceHost,
	type StageAcceptanceHost,
	type StageHistoryCommandOutcome,
	type StageHistoryState
} from '../host-acceptance';
import type { StageSession } from '../stage-session';
import { stageEnvelope } from '../unit-stage-source';
import { perfMark } from '$lib/platform/perf-marks';
import type { StageAssetLeases } from './stage-asset-leases.svelte';

/** The existing project-session API, narrowed to what the epoch composes. */
export type StageProjectEpochProjectSession = {
	readonly headSave: { refresh(): void } | null;
	unmountSave(): void;
	mountSave(host: StageAcceptanceHost, snapshot: StageReadSnapshot): void;
	updateSnapshot(snapshot: StageReadSnapshot): void;
	dispose(): void;
};

/** The existing Preview controller, narrowed to the epoch's reset/close duties. */
export type StageProjectEpochPreview = {
	reset(): void;
	close(): void;
	readonly openState: boolean;
};

export type StageProjectEpochInput = {
	readonly session: StageSession;
	readonly assets: StageAssetLeases;
	/** Lazy: project-session is constructed around this controller's `activate`. */
	readonly projectSession: () => StageProjectEpochProjectSession;
	/** Lazy: Preview is constructed against this controller's facade getter. */
	readonly preview: () => StageProjectEpochPreview;
	readonly createFacade: (snapshot: StageReadSnapshot) => StageFacade;
	readonly adapterFactories: readonly StageAdapterFactory[];
	/** Clear old hover and interrupt the old gesture before the session swaps. */
	readonly interruptInput: () => void;
	readonly resetFocus: () => void;
	/** Presentation that names the replaced source, cleared before disposal. */
	readonly resetPresentationBeforeSwap: () => void;
	/** Full view reset once the new epoch is mounted (the baseline's `resetViewContext`). */
	readonly resetPresentation: () => void;
	/** The new facade exists; bind host tools and re-read session-level view state. */
	readonly onFacadeMounted: (facade: StageFacade) => void;
	readonly onAdaptersChanged: () => void;
	readonly onAccepted: () => void;
	readonly onHistoryInstalled: (
		outcome: Extract<StageHistoryCommandOutcome, { kind: 'installed' }>
	) => void;
	readonly onNotice: (message: string) => void;
	/** Publish the mounted view after a history command completes. */
	readonly refresh: () => void;
	readonly isActiveProject: () => boolean;
	/** Deterministic test seams; production uses the existing owners. */
	readonly createAcceptance?: typeof createStageAcceptanceHost;
	readonly createServices?: typeof createStageAdapterServices;
	readonly mountAdapter?: typeof mountStageAdapter;
};

export type StageProjectEpoch = ReturnType<typeof createStageProjectEpoch>;

const EMPTY_HISTORY: StageHistoryState = {
	canUndo: false,
	canRedo: false,
	depth: 1,
	position: 0,
	undoUnavailableReason: 'Nothing to undo yet — no change has been accepted.',
	redoUnavailableReason: 'Nothing to redo.'
};

function sameHistory(left: StageHistoryState, right: StageHistoryState): boolean {
	return (
		left.canUndo === right.canUndo &&
		left.canRedo === right.canRedo &&
		left.depth === right.depth &&
		left.position === right.position &&
		left.undoUnavailableReason === right.undoUnavailableReason &&
		left.redoUnavailableReason === right.redoUnavailableReason
	);
}

export function createStageProjectEpoch(input: StageProjectEpochInput) {
	const createAcceptance = input.createAcceptance ?? createStageAcceptanceHost;
	const createServices = input.createServices ?? createStageAdapterServices;
	const mountAdapter = input.mountAdapter ?? mountStageAdapter;

	let facade = $state.raw<StageFacade | null>(null);
	let acceptance = $state.raw<StageAcceptanceHost | null>(null);
	let services = $state.raw<ReturnType<typeof createStageAdapterServices> | null>(null);
	let history = $state.raw<StageHistoryState>(EMPTY_HISTORY);
	let unsubscribeContributions: (() => void) | null = null;
	let unsubscribeAcceptance: (() => void) | null = null;
	let tornDown = false;
	let disposed = false;

	function mountedHistory(): StageHistoryState {
		return (
			acceptance?.history() ?? {
				canUndo: false,
				canRedo: false,
				depth: 1,
				position: 0,
				undoUnavailableReason: 'History belongs to the mounted project.',
				redoUnavailableReason: 'History belongs to the mounted project.'
			}
		);
	}

	/** Re-read the acceptance host's history; assigns only a changed value. */
	function refreshHistory(): void {
		const next = mountedHistory();
		if (sameHistory(next, history)) return;
		history = next;
	}

	/**
	 * Mount one admitted project epoch.
	 *
	 * The admitted snapshot is the session's validation-first replacement input.
	 * A completion that arrives after teardown is dropped: nothing would dispose
	 * the stage it would create.
	 */
	function activate(snapshot: StageReadSnapshot): void {
		if (tornDown) return;
		// Replacement: validate first (the snapshot is already admitted), then the
		// session atomically cancels writers, clears selection/task and swaps.
		input.interruptInput();
		input.session.replace(snapshot);
		// A Preview run and the lens focus name identities from the replaced source;
		// the warm surface cannot describe the new one. Drop both (the chunk stays
		// cached) rather than keeping another project's scene alive behind the editor.
		input.preview().reset();
		services = null;
		input.resetFocus();
		input.resetPresentationBeforeSwap();
		// The previous facade's listeners are dropped before its replacement exists,
		// so a disposal-time notification cannot write through the new facade.
		unsubscribeContributions?.();
		unsubscribeContributions = null;
		facade?.dispose();
		acceptance?.dispose();
		const nextFacade = input.createFacade(snapshot);
		facade = nextFacade;
		input.onFacadeMounted(nextFacade);
		unsubscribeContributions = nextFacade.onAdaptersChanged(() => {
			input.onAdaptersChanged();
		});
		// The host owns one inspection output; every viewing intent presents this
		// claim's ticket, so a replaced or rebased output cannot keep writing.
		nextFacade.acquireInspection('exclusive');
		// One acceptance coordinator per project epoch, starting from the admitted
		// baseline. The coordinator's bounded history is the single history.
		const mounted = createAcceptance({
			sessionEpoch: snapshot.sessionEpoch,
			baseline: {
				revision: snapshot.acceptedRevision,
				source: stageEnvelope(snapshot),
				// The baseline's bytes must be the snapshot's own canonical form: the F4
				// adapter re-admits them on Undo and refuses a different serialization.
				canonicalJson: snapshot.canonicalJson,
				sourceContentId: snapshot.sourceContentId
			},
			facade: nextFacade
		});
		// The baseline released the previous epoch's subscription only after the new
		// host exists; keep that exact point.
		unsubscribeAcceptance?.();
		const projectSession = input.projectSession();
		projectSession.unmountSave();
		// The mounted facade is the epoch's source. The mark is the anchor the
		// performance harness uses for the first architectural frame (F1/F2).
		perfMark('build:identity', {
			version: typeof __BISKIQ_BUILD_REVISION__ === 'string' ? __BISKIQ_BUILD_REVISION__ : 'unverified'
		});
		perfMark('stage:activated', { sourceContentId: snapshot.sourceContentId });
		acceptance = mounted;
		services = createServices(nextFacade, mounted);
		void input.assets.resolve(snapshot);
		unsubscribeAcceptance = mounted.onChanged(() => {
			// A stale acceptance host cannot write through the newer epoch.
			if (acceptance !== mounted || tornDown) return;
			// A source change ends the Preview claim through the protocol's rebase (the
			// output's source identity is no longer current), so leaving it restores
			// nothing: the Stage continues under the claim the content change minted.
			const preview = input.preview();
			if (preview.openState) preview.close();
			refreshHistory();
			// The Save state derives its status from the accepted source, so an
			// accepted edit is what makes the project dirty. Without this refresh
			// the Head keeps reporting the pre-edit status and the exit/replacement
			// guards never see unsaved work.
			projectSession.headSave?.refresh();
			if (facade !== null && input.isActiveProject()) {
				projectSession.updateSnapshot(facade.snapshot());
				// A newly placed (or removed) model changes the pins this epoch holds.
				void input.assets.resolve(facade.snapshot());
			}
			input.onAccepted();
		});
		for (const factory of input.adapterFactories) mountAdapter(nextFacade, mounted, factory);
		// The previous epoch's controller belongs to its disposed coordinator; this
		// epoch gets exactly one state machine over the new one.
		projectSession.mountSave(mounted, snapshot);
		history = mounted.history();
		input.resetPresentation();
	}

	/**
	 * Run one existing history command and publish its presentation result.
	 *
	 * This adds no history: the acceptance host's coordinator is the one stack.
	 * A command that resolves after a replacement or teardown changes nothing.
	 */
	async function runHistory(direction: 'undo' | 'redo'): Promise<void> {
		const host = acceptance;
		if (host === null) return;
		const label = direction === 'undo' ? 'Undo' : 'Redo';
		perfMark(`command:${direction}`);
		const outcome = direction === 'undo' ? await host.undo() : await host.redo();
		if (acceptance !== host || tornDown) return;
		if (outcome.kind === 'installed') {
			// The restored state installed through the same facade path an accept uses:
			// the view stays, the selection was requalified against the restored
			// correspondence, and the caller refreshes the plan/markers from it.
			input.onHistoryInstalled(outcome);
		} else if (outcome.kind === 'unavailable') {
			input.onNotice(
				outcome.reason === 'live-proposal'
					? `A proposal is live; ${label} runs once it settles.`
					: `Nothing to ${direction}.`
			);
		} else if (outcome.kind === 'refused') {
			input.onNotice(
				outcome.compensation === 'failed'
					? `${outcome.message} The history could not be rolled back to match what is shown.`
					: outcome.message
			);
		}
		refreshHistory();
		input.refresh();
	}

	/** Mark teardown before the route stops its lens/viewport/input callbacks. */
	function markTornDown(): void {
		tornDown = true;
	}

	/**
	 * Release the epoch's subscriptions and project-bound owners.
	 *
	 * The route calls this after stopping lens/viewport/input callbacks and before
	 * disposing the Stage session; the order is the baseline teardown order:
	 * contributions, acceptance subscription, project-session, acceptance, facade,
	 * project-bound assets, then the Stage session.
	 */
	function dispose(): void {
		if (disposed) return;
		disposed = true;
		markTornDown();
		unsubscribeContributions?.();
		unsubscribeAcceptance?.();
		unsubscribeContributions = null;
		unsubscribeAcceptance = null;
		input.projectSession().dispose();
		acceptance?.dispose();
		facade?.dispose();
		input.assets.dispose();
		input.session.dispose();
	}

	return {
		get facade(): StageFacade | null {
			return facade;
		},
		get acceptance(): StageAcceptanceHost | null {
			return acceptance;
		},
		get services(): ReturnType<typeof createStageAdapterServices> | null {
			return services;
		},
		get history(): StageHistoryState {
			return history;
		},
		get tornDown(): boolean {
			return tornDown;
		},
		activate,
		undo: () => runHistory('undo'),
		redo: () => runHistory('redo'),
		refreshHistory,
		markTornDown,
		dispose
	};
}
