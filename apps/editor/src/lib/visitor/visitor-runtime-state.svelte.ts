/**
 * Visitor runtime — Experience-unit orchestration (AM-9, T3.P01.S04).
 *
 * The visitor executes one lowered `ExecutionProgram@3` through the single
 * Experience reducer. There is no node-keyed order, no main-flow walk and no
 * Scene `nextNodeId`/`previousNodeId` traversal: Guide order is authored in the
 * Experience unit, lowering produces the program, and this store only dispatches
 * explicit events at editorial arrival. Camera framing is read from the current
 * Stop's Presentation view; motion remains the Camera authority's.
 */
import {
	buildExperienceCompanion,
	createExperienceRun,
	reduceExperience,
	type ExecutionProgram,
	type ExperienceEffect,
	type ExperienceEvent,
	type ExperienceInterpreterOptions,
	type ExperienceReduceResult,
	type ExperienceRunState,
	type ExperienceTransition,
	type ProgramInvocation
} from '@portfolio/project-model/units';

/** One Camera move the interpreter advanced through inside a single tick. */
export type VisitorTickMotion = {
	readonly invocation: ProgramInvocation;
	readonly viewId: string;
};

export type VisitorRuntimeInput = {
	readonly program: ExecutionProgram;
	readonly options: ExperienceInterpreterOptions;
};

export class VisitorRuntimeState {
	readonly program: ExecutionProgram;
	readonly options: ExperienceInterpreterOptions;
	/** Set by the host from `prefers-reduced-motion`; affects camera motion only. */
	reducedMotion = $state(false);
	state: ExperienceRunState = $state<ExperienceRunState>() as ExperienceRunState;

	/** Fractional frame milliseconds carried until they form one interpreter tick. */
	private pendingMilliseconds = 0;
	/** Camera moves the reducer crossed without pausing; the time-aligned director drains them. */
	private queuedMotions: VisitorTickMotion[] = [];

	constructor({ program, options }: VisitorRuntimeInput) {
		this.program = program;
		this.options = options;
		this.state = createExperienceRun(program, options);
	}

	/**
	 * Fold one event into this run through the one pure Experience reducer. The run
	 * state held here is the only copy: nothing else keeps an interpreter-side copy
	 * that could drift from it.
	 */
	private reduce(event: ExperienceEvent, options: ExperienceInterpreterOptions = this.options): ExperienceReduceResult {
		return reduceExperience(this.program, this.state, event, options);
	}

	private runIdentity(): { readonly runId: string; readonly runEpoch: number } {
		return { runId: this.state.runId, runEpoch: this.state.runEpoch };
	}

	/** Enter the Experience at its authored entry Stop. Idempotent. */
	enter() {
		this.state = this.reduce({ kind: 'enter', ...this.runIdentity() }).state;
	}

	/**
	 * Start the run from the surface's entry choice. An explicit Presentation entry
	 * wins; otherwise the authored entry Stop is entered when one exists. A
	 * Guide-free program with no entry Stop stays `ready` so Presentations remain
	 * enterable from the list.
	 */
	start(entryPresentationId: string | null) {
		this.queuedMotions = [];
		if (entryPresentationId !== null) {
			this.state = this.reduce({ kind: 'enter-presentation', ...this.runIdentity(), presentationId: entryPresentationId }).state;
			return;
		}
		if (this.program.entryStopId !== null) this.enter();
	}

	/** The explicit Continue control. A Gate or a finished hold advances once. */
	continue() {
		this.state = this.reduce({ kind: 'continue', ...this.runIdentity() }).state;
	}

	/**
	 * Return to the Guide position a Presentation suspended. Only this explicit
	 * control returns; Continue never does.
	 */
	resume() {
		this.queuedMotions = [];
		this.state = this.reduce({ kind: 'resume', ...this.runIdentity() }).state;
	}

	/** An explicit authored destination; the Guide is never bypassed by this. */
	navigate(stopId: string) {
		this.state = this.reduce({ kind: 'navigate', ...this.runIdentity(), stopId }).state;
	}

	/**
	 * The visitor's Prev control: an explicit destination at the previous Stop's
	 * first View, realized as a Cut. The authored Travel into this Stop belongs to
	 * the forward approach, so the one backward edge is given a Cut transition for
	 * this event only; the Experience reducer still arrives the Stop and owns its
	 * occurrence, panel and holds. Returns false at Stop 1 or when no Stop is current.
	 */
	previousStop(): boolean {
		const fromStopId = this.state.stopId;
		if (fromStopId === null) return false;
		const index = this.program.stops.findIndex((stop) => stop.id === fromStopId);
		const previous = index > 0 ? this.program.stops[index - 1] : undefined;
		const firstViewId = previous?.views[0]?.viewId;
		if (previous === undefined || firstViewId === undefined) return false;
		const cut: ExperienceTransition = {
			fromStopId,
			toStopId: previous.id,
			invocation: { kind: 'cut', viewId: firstViewId }
		};
		const transitions = [
			cut,
			...(this.options.transitions ?? []).filter(
				(entry) => entry.fromStopId !== fromStopId || entry.toStopId !== previous.id
			)
		];
		const result = this.reduce(
			{ kind: 'navigate', ...this.runIdentity(), stopId: previous.id },
			{ ...this.options, transitions }
		);
		if (result.outcome !== 'accepted') return false;
		this.queuedMotions = [];
		this.state = result.state;
		return true;
	}

	/**
	 * Enter an explorable Presentation at its Default through the interpreter's
	 * Presentation-entry event. It realizes the Presentation's Default View through
	 * the same Camera authority and never fabricates a Stop.
	 */
	selectPresentation(presentationId: string): boolean {
		if (!this.freePresentations.some((presentation) => presentation.id === presentationId)) return false;
		const result = this.reduce({ kind: 'enter-presentation', ...this.runIdentity(), presentationId });
		if (result.outcome !== 'accepted') return false;
		this.queuedMotions = [];
		this.state = result.state;
		return true;
	}

	/**
	 * R217.S30 — after the authored run ends, free exploration starts a fresh
	 * neutral presentation-entry run. The completed run is never reused: its
	 * terminal phase would ignore `enterPresentation`.
	 */
	beginFreeExploration() {
		this.pendingMilliseconds = 0;
		this.queuedMotions = [];
		this.state = createExperienceRun(this.program, this.options);
	}

	/**
	 * Start the tour again on the same run: the end screen's explicit restart.
	 * It rewinds this run to its authored entry; it never mints a second run.
	 */
	restart() {
		this.queuedMotions = [];
		this.state = this.reduce({ kind: 'reset', ...this.runIdentity() }).state;
	}

	/** Finish the tour: the visitor ends the run from its own control. */
	finish() {
		if (this.ended) return;
		this.queuedMotions = [];
		this.state = this.reduce({ kind: 'cancel', ...this.runIdentity() }).state;
	}

	/** Advance the explicit clock; holds auto-continue on expiry. */
	tick(milliseconds: number) {
		if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
		// The interpreter's clock is integer milliseconds. A renderer supplies
		// `delta * 1000` (≈16.67 at 60 fps), so accumulate and dispatch whole
		// milliseconds rather than dropping every fractional frame.
		this.pendingMilliseconds += milliseconds;
		const wholeMilliseconds = Math.floor(this.pendingMilliseconds);
		if (wholeMilliseconds <= 0) return;
		this.pendingMilliseconds -= wholeMilliseconds;
		const wasHolding = this.state.phase === 'holding';
		const ticked = this.reduce({ kind: 'tick', ...this.runIdentity(), milliseconds: wholeMilliseconds });
		this.state = ticked.state;
		this.queuedMotions.push(...this.cameraMotions(ticked.effects));
		// A hold is time, not a prompt: when the authored hold expires the run
		// continues itself. A Gate is different and stays blocked until the
		// visitor's explicit Continue.
		if (wasHolding && this.state.phase === 'ready' && this.state.holdRemainingMs === 0 && !this.state.gated) {
			const continued = this.reduce({ kind: 'continue', ...this.runIdentity() });
			this.state = continued.state;
			this.queuedMotions.push(...this.cameraMotions(continued.effects));
		}
	}

	/**
	 * Drain the ordered Camera moves a tick crossed. A zero-hold Travel between
	 * two Views otherwise appears only as the interpreter's final invocation, so
	 * Preview would omit its authored duration and pose.
	 */
	takeTickMotions(): readonly VisitorTickMotion[] {
		const motions = this.queuedMotions;
		this.queuedMotions = [];
		return motions;
	}

	private cameraMotions(effects: readonly ExperienceEffect[]): VisitorTickMotion[] {
		const motions: VisitorTickMotion[] = [];
		for (let index = 0; index < effects.length; index += 1) {
			const effect = effects[index]!;
			if (effect.kind !== 'camera') continue;
			const next = effects[index + 1];
			const stepViewId = next?.kind === 'step' ? next.viewId : null;
			const arrivalViewId = effect.stopId === null
				? null
				: this.program.stops.find((stop) => stop.id === effect.stopId)?.views[0]?.viewId ?? null;
			const viewId = stepViewId ?? arrivalViewId;
			if (viewId !== null) motions.push({ invocation: effect.invocation, viewId });
		}
		return motions;
	}

	get currentStop() {
		return this.state.stopId === null
			? null
			: this.program.stops.find((stop) => stop.id === this.state.stopId) ?? null;
	}

	get currentPresentation() {
		const presentationId = this.state.presentationId;
		return presentationId === null
			? null
			: this.program.presentations.find((presentation) => presentation.id === presentationId) ?? null;
	}

	get freePresentations() {
		return this.program.presentations.filter((presentation) => presentation.explorable);
	}

	get currentViewIndex(): number | null {
		return this.state.viewIndex;
	}

	/** The Camera View this run presents. */
	get currentViewId(): string | null {
		return this.state.viewId;
	}

	get currentInvocation(): ProgramInvocation | null {
		return this.state.invocation;
	}

	get currentInvocationFromViewId(): string | null {
		return this.state.invocationFromViewId;
	}

	get ended() {
		return this.state.phase === 'completed' || this.state.phase === 'cancelled';
	}

	/** The last View was untimed and the tour waits for Next. */
	get waiting() {
		return this.state.phase === 'ready' && this.state.holdRemainingMs === null && this.state.stopId !== null;
	}

	/** Whether a suspended Guide position can be returned to. */
	get canResume(): boolean {
		return this.state.resume !== null;
	}

	get companion() {
		return buildExperienceCompanion(this.program, this.state);
	}
}

export function createVisitorRuntimeState(input: VisitorRuntimeInput) {
	return new VisitorRuntimeState(input);
}
