import { intersectWorkingPlane, pointerRay, projectWorld, type ViewportEvaluation } from '@portfolio/camera-core';
import type { StageReadSnapshot } from '../accepted-read';
import { EMPTY_SELECTION } from '../semantic-selection';
import { STAGE_DRAFTING_DEFAULTS } from '../stage-drafting';
import type { StageAdapter, StageAdapterBinding, StageAdapterContext, StageAdapterRegistration, StageIntentResult } from './adapter-contract';

/** The capabilities this host actually provides. Anything else refuses mounting. */
export const HOST_STAGE_CAPABILITIES: readonly string[] = [
	'viewport-projection-v1',
	'layout-plan-representation-v1',
	'stage-selection-v1',
	'stage-instrument-v1',
	// T5.P01.S02 — Ink is one Pen that can carry readings from more than one
	// domain. The host keeps the contribution list; the reading's own session
	// owns its meaning, so this adds no document state to the Stage.
	'ink-readings-v1'
];

/**
 * The symbol key of the install-time mutation control.
 *
 * A conformance test uses it to run the real install with adapter re-binding
 * suppressed, proving the rebind/disposal assertions are load-bearing. It is a
 * symbol, not a string option, so no ordinary caller — and no serialized option
 * object — can switch it on by accident.
 */
export const SKIP_REBIND_CONTROL: unique symbol = Symbol('stage-skip-rebind-control');

export type BoundAdapter = {
	readonly adapter: Pick<StageAdapter, 'id' | 'plannerKinds'>;
	readonly contributions: StageAdapterBinding;
};

export type AdapterContextHandle = { readonly context: StageAdapterContext; end(): void };

type AdapterBindingsPort = Pick<StageAdapterContext,
	'selection' | 'selectionState' | 'select' | 'setSelection' | 'drafting' | 'requestIntent'
> & {
	readonly snapshot: () => StageReadSnapshot;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly evaluationId: () => string | null;
	readonly idOf: (evaluation: ViewportEvaluation) => string;
	readonly cameraState: () => Extract<StageIntentResult, { kind: 'superseded' }>['state'];
	readonly pickScene?: (ray: Parameters<StageAdapterContext['pickScene']>[0], scene: StageReadSnapshot['domain']['scene']) => ReturnType<StageAdapterContext['pickScene']>;
	readonly sceneBounds?: (id: string, scene: StageReadSnapshot['domain']['scene']) => ReturnType<StageAdapterContext['sceneBounds']>;
	readonly isLive: () => boolean;
	readonly isDisposed: () => boolean;
	readonly registrationRemoved: (id: string) => void;
	readonly addDisposable: (dispose: () => void) => void;
	readonly invalidateSubjects: () => void;
};

/** One ordered registry and contribution notification channel per facade. */
export function createAdapterBindings(input: AdapterBindingsPort) {
	/** Live listeners for the contribution surface; see `onAdaptersChanged`. */
	const adapterListeners = new Set<() => void>();
	let adaptersChangeQueued = false;
	/**
	 * Monotone version of every input a contributed output array can read besides
	 * the evaluation, the accepted snapshot and the live selection/hover/task.
	 * Adapter state that changes a preview asks for a surface change; that request
	 * (and every registration change) lands here, so an unchanged read returns the
	 * previous array instead of rebuilding it on every display frame.
	 */
	let outputsRevision = 0;
	function notifyAdaptersChanged(): void {
		outputsRevision += 1;
		for (const listener of [...adapterListeners]) {
			try {
				listener();
			} catch {
				// A listener that throws must not strand the rest or the facade.
			}
		}
	}
	/** Coalesce rebuild notifications out of the read path that discovered them. */
	function scheduleAdaptersChanged(): void {
		if (adaptersChangeQueued) return;
		adaptersChangeQueued = true;
		queueMicrotask(() => {
			adaptersChangeQueued = false;
			notifyAdaptersChanged();
		});
	}
	/**
	 * Registration id → the adapter, its current binding and the disposer that ends
	 * that binding exactly once. A factory-bound adapter is rebuilt per accepted
	 * snapshot; a static one keeps one binding for the mount.
	 */
	const adapters = new Map<
		string,
		{
			adapter: StageAdapter;
			contributions: StageAdapterBinding;
			/** `true` when the adapter builds a binding per accepted snapshot. */
			factory: boolean;
			/** A factory binding waiting for the next live evaluation. */
			pending: boolean;
			/** Ends the current binding. */
			dispose: () => void;
			/**
			 * Ends the registration, once (E4): for a factory adapter, its own
			 * `dispose` after its last binding; for a static adapter, nothing beyond
			 * its binding.
			 */
			end: () => void;
		}
	>();
	/**
	 * One adapter context plus the handle that ends it.
	 *
	 * A context is bounded by **its binding**, not by the session's writer
	 * generation: opening or closing a task must not invalidate an adapter's
	 * selection capability, because the binding is still built from live content and
	 * the adapter is still registered. `end()` is what makes a rebuilt, replaced or
	 * disposed binding's old callbacks inert — the same lifetime the disposer already
	 * ends. Task-scoped callbacks are the ones that expire with a writer generation,
	 * and the instrument services guard them with it separately.
	 */
	function adapterContext(): AdapterContextHandle | null {
		const evaluation = input.evaluation();
		if (!input.isLive() || evaluation === null) return null;
		const boundSnapshot = input.snapshot();
		let ended = false;
		const contextIsLive = () => !ended && input.isLive() && input.snapshot() === boundSnapshot;
		const token = evaluation.token;
		const id = input.idOf(evaluation);
		const hasLiveEvaluation = () => contextIsLive() && input.evaluationId() === id;
		const context: StageAdapterContext = {
			snapshot: boundSnapshot,
			evaluation,
			evaluationId: id,
			project(point) {
				if (!hasLiveEvaluation()) return null;
				const result = projectWorld(point, evaluation, token);
				return result.kind === 'projected' ? result.css : null;
			},
			ray(css) {
				if (!hasLiveEvaluation()) return null;
				const result = pointerRay(css, evaluation, token);
				return result.kind === 'ray' ? result.ray : null;
			},
			intersect(ray, plane) {
				if (!hasLiveEvaluation()) return { kind: 'failed', code: 'stale-evaluation', message: 'the adapter evaluation has ended' };
				return intersectWorkingPlane(ray, plane, evaluation, token);
			},
			pickScene: (ray) => hasLiveEvaluation() ? input.pickScene?.(ray, boundSnapshot.domain.scene) ?? null : null,
			sceneBounds: (id) => hasLiveEvaluation() ? input.sceneBounds?.(id, boundSnapshot.domain.scene) ?? null : null,
			selection: () => contextIsLive() ? input.selection() : null,
			selectionState: () => contextIsLive() ? input.selectionState() : EMPTY_SELECTION,
			setSelection: (value) => contextIsLive() ? input.setSelection(value) : { kind: 'refused', code: 'stale-binding', message: 'Reacquire the active adapter binding.' },
			select: (selection) => { if (contextIsLive()) input.select(selection); },
			// View state is still a session fact: an ended binding must not keep
			// reading the live session's Grid/Snap after its adapter is gone.
			drafting: () => (contextIsLive() ? input.drafting() : STAGE_DRAFTING_DEFAULTS),
			// The adapter names the clock: an adapter-initiated transition starts at
			// the caller's own time, never at a fabricated zero that would make every
			// transition begin in the past and land instantly.
			requestIntent: (intent, clockSeconds) =>
				contextIsLive() ? input.requestIntent(intent, clockSeconds)
				: { kind: 'superseded', state: input.cameraState(), message: 'the adapter binding lifetime has ended' }
		};
		return { context, end: () => { ended = true; } };
	}
	function echoSelection(): void {
		for (const entry of adapters.values()) {
			try { entry.contributions.selectionEcho?.(input.selection()); entry.contributions.selectionChanged?.(input.selectionState()); } catch { /* Subscriber isolation. */ }
		}
	}
	/** End every binding and registration: used by dispose, never by a content change. */
	function endAdapters(): void {
		for (const entry of [...adapters.values()]) {
			entry.dispose();
			entry.end();
		}
		adapters.clear();
		input.invalidateSubjects();
	}

	function once(dispose: () => void): () => void {
		let ended = false;
		return () => {
			if (ended) return;
			ended = true;
			try { dispose(); } catch { /* Cleanup must continue for the other bindings. */ }
		};
	}

	/**
	 * Build one factory binding for the current snapshot.
	 *
	 * A factory that throws yields an empty binding rather than taking the host
	 * down: the adapter stays registered (so its failure is visible and repairable)
	 * but contributes nothing until the next accepted snapshot rebuilds it. A
	 * factory needs a live viewport output, so a build with no evaluation defers to
	 * `ensureBindings` rather than projecting against a viewport that no longer
	 * exists.
	 */
	function buildBinding(adapter: StageAdapter):
		| { readonly kind: 'built'; readonly contributions: StageAdapterBinding; readonly dispose: () => void }
		| { readonly kind: 'deferred' } {
		const handle = adapterContext();
		if (adapter.bind === undefined || handle === null) return { kind: 'deferred' };
		const { context, end } = handle;
		let binding: StageAdapterBinding = {};
		try {
			binding = adapter.bind({ ...context, adapterId: adapter.id });
		} catch {
			binding = {};
		}
		// A freshly built binding starts from the live selection, delivered once.
		// The install requalified it before any rebuild, so the adapter observes the
		// surviving selection — never a cleared-then-restored pair.
		const live = input.selection();
		try {
			if (live !== null) binding.selectionEcho?.(live);
			binding.selectionChanged?.(input.selectionState());
		} catch {
			// A throwing echo leaves the binding registered.
		}
		return { kind: 'built', contributions: binding, dispose: once(() => { end(); binding.dispose?.(); }) };
	}

	/**
	 * Rebuild every pending factory binding once a live evaluation exists again.
	 *
	 * A source rebase ends the old evaluation, so a rebuild waits for the host's
	 * next frame instead of being built against a viewport that no longer exists.
	 * A successful build replaces the pending entry.
	 */
	function ensureBindings(): void {
		if (input.evaluation() === null) return;
		let rebuilt = false;
		for (const [id, entry] of [...adapters.entries()]) {
			if (!entry.factory || !entry.pending) continue;
			const built = buildBinding(entry.adapter);
			if (built.kind === 'deferred') continue;
			adapters.set(id, {
				adapter: entry.adapter,
				contributions: built.contributions,
				factory: true,
				pending: false,
				dispose: built.dispose,
				end: entry.end
			});
			rebuilt = true;
			// The read that discovered this rebuild must not answer with the array built
			// from the previous binding; the deferred notification still tells listeners.
			outputsRevision += 1;
		}
		if (rebuilt) input.invalidateSubjects();
		// A rebuild is discovered **inside a read** (`overlays()`, `tasks()`, …), and the
		// host reads those from derived values. Notifying synchronously here would let a
		// subscriber write reactive state while a derivation is being evaluated, which
		// Svelte refuses. The rebuild invalidates the contribution surface on a
		// microtask instead; register/dispose keep notifying synchronously because they
		// originate from events.
		if (rebuilt) scheduleAdaptersChanged();
	}

	/**
	 * Host-owned re-binding across installs.
	 *
	 * The previous binding is disposed **exactly once, at install time** — it was
	 * built from content that no longer exists — and the next one is built against
	 * the newly installed snapshot on the next live evaluation. Live editing
	 * therefore never tears a domain adapter's registration down. Adapters without a
	 * factory are static and are left alone; replacement still ends everything
	 * through `endAdapters`.
	 */
	function rebindAdapters(): readonly string[] {
		const rebound = [...adapters.entries()]
			.filter(([, entry]) => entry.factory)
			.map(([id]) => id);
		for (const id of rebound) {
			const entry = adapters.get(id)!;
			entry.dispose();
			adapters.set(id, {
				adapter: entry.adapter,
				contributions: {},
				factory: true,
				pending: true,
				dispose: () => {},
				end: entry.end
			});
		}
		if (rebound.length > 0) input.invalidateSubjects();
		if (rebound.length === 0) return rebound;
		ensureBindings();
		return rebound;
	}

	function registerStageAdapter(adapter: StageAdapter): StageAdapterRegistration {
		if (!input.isLive()) {
			return {
				kind: 'refused',
				code: 'unknown-required-capability',
				missing: [],
				message: 'the stage is disposed and mounts no adapter'
			};
		}
		if (adapters.has(adapter.id)) {
			return {
				kind: 'refused',
				code: 'duplicate-adapter',
				missing: [],
				message: `an adapter "${adapter.id}" is already registered`
			};
		}
		const required = adapter.requiredCapabilities ?? [];
		const missing = required.filter((capability) => !HOST_STAGE_CAPABILITIES.includes(capability));
		if (missing.length > 0) {
			return {
				kind: 'refused',
				code: 'unknown-required-capability',
				missing,
				message: `this host does not provide ${missing.join(', ')}; refusing to mount "${adapter.id}"`
			};
		}
		let ended = false;
		const factory = adapter.bind !== undefined;
		const built = factory
			? buildBinding(adapter)
			: { kind: 'built' as const, contributions: adapter, dispose: once(() => adapter.dispose?.()) };
		// The map entry owns the *binding* disposer; the registration disposer also
		// removes the entry, so a content change never ends a registration.
		const bindingDispose = built.kind === 'built' ? built.dispose : () => {};
		// E4 — one shared, once-only registration end. A factory adapter's own
		// `dispose` releases what it holds for the registration (the Layout
		// adapter's project compile context); it runs after its last binding.
		const endRegistration = factory ? once(() => adapter.dispose?.()) : () => {};
		const dispose = () => {
			if (ended) return;
			ended = true;
			const currentBinding = input.isDisposed() ? undefined : adapters.get(adapter.id);
			adapters.delete(adapter.id);
			input.invalidateSubjects();
			input.registrationRemoved(adapter.id);
			currentBinding?.dispose();
			endRegistration();
			notifyAdaptersChanged();
		};
		adapters.set(adapter.id, {
			adapter,
			contributions: built.kind === 'built' ? built.contributions : {},
			factory,
			pending: factory && built.kind === 'deferred',
			dispose: bindingDispose,
			end: endRegistration
		});
		input.invalidateSubjects();
		input.addDisposable(dispose);
		notifyAdaptersChanged();
		return { kind: 'registered', id: adapter.id, dispose };
	}
	function onAdaptersChanged(listener: () => void): () => void {
		adapterListeners.add(listener);
		return () => {
			adapterListeners.delete(listener);
		};
	}

	function echoStaticSelection(surviving: ReturnType<StageAdapterContext['selection']>): void {
		if (surviving !== null) {
			for (const entry of adapters.values()) {
				if (entry.factory) continue;
				try { entry.contributions.selectionEcho?.(surviving); } catch { /* Subscriber isolation. */ }
			}
		}
		for (const entry of adapters.values()) {
			if (entry.factory) continue;
			try { entry.contributions.selectionChanged?.(input.selectionState()); } catch { /* Subscriber isolation. */ }
		}
	}

	function notifyTaskClosed(): void {
		for (const entry of adapters.values()) {
			try { entry.contributions.taskClosed?.(); } catch { /* Subscriber isolation. */ }
		}
	}

	const entries: ReadonlyMap<string, BoundAdapter> = adapters;

	function dispose(): void {
		endAdapters();
		notifyAdaptersChanged();
		adapterListeners.clear();
	}

	return {
		entries,
		adapters: () => [...adapters.values()].map((entry) => entry.adapter),
		revision: () => outputsRevision,
		adapterContext,
		ensureBindings,
		rebindAdapters,
		echoSelection,
		echoStaticSelection,
		notifyTaskClosed,
		registerStageAdapter,
		onAdaptersChanged,
		notifyAdaptersChanged,
		dispose
	};
}
