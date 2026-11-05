/**
 * Visitor runtime — Experience-unit orchestration (AM-9, T3.P01.S04).
 *
 * The visitor executes one lowered `ExecutionProgram@4` through the single
 * Experience reducer. There is no node-keyed order, no main-flow walk and no
 * Scene `nextNodeId`/`previousNodeId` traversal: Guide order is authored in the
 * Experience unit, lowering produces the program, and this store only dispatches
 * explicit events at editorial arrival. Camera framing is read from the current
 * Stop's Presentation view; motion remains the Camera authority's.
 *
 * One Guide clock (sheet §31): play, pause, wait and Explore are run state in
 * the reducer, never a second flag here or in the director. A stay counts only
 * after its arrival: the director confirms a finished arrival Travel with
 * `arrival()`, in Preview and in a release alike.
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

	/**
	 * Next. Always available at a Stop: during an arrival Travel it lands now, at
	 * a Stop it moves on, on the last Stop it finishes; in Automatic it also
	 * resumes play.
	 */
	continue() {
		this.queuedMotions = [];
		this.state = this.reduce({ kind: 'continue', ...this.runIdentity() }).state;
	}

	/** The director finished the arrival Travel: the Stop's stay starts now. */
	arrival() {
		if (this.state.phase !== 'traveling') return;
		this.state = this.reduce({ kind: 'arrival', ...this.runIdentity() }).state;
	}

	/** Automatic only: freeze the Guide clock, mid-Travel included. */
	pause() {
		this.state = this.reduce({ kind: 'pause', ...this.runIdentity() }).state;
	}

	play() {
		this.state = this.reduce({ kind: 'play', ...this.runIdentity() }).state;
	}

	togglePause() {
		if (this.state.paused) this.play();
		else this.pause();
	}

	/**
	 * Explore the current Stop's Presentation from the View the visitor sees. It
	 * keeps the Stop occurrence suspended and freezes the Guide clock; during an
	 * arrival Travel it lands first.
	 */
	explore(): boolean {
		const stop = this.currentStop;
		if (stop === null) return false;
		const viewId = this.state.phase === 'traveling' ? stop.entryViewId : (this.state.viewId ?? stop.entryViewId);
		const result = this.reduce({
			kind: 'enter-presentation',
			...this.runIdentity(),
			presentationId: stop.presentationId,
			viewId
		});
		if (result.outcome !== 'accepted') return false;
		this.queuedMotions = [];
		this.state = result.state;
		return true;
	}

	/** In Explore: step to one View — the authored step when adjacent, else a Cut. */
	exploreView(viewId: string): boolean {
		const result = this.reduce({ kind: 'explore-view', ...this.runIdentity(), viewId });
		if (result.outcome !== 'accepted') return false;
		this.state = result.state;
		return true;
	}

	/** ‹ › in Explore: the previous or next View of the Presentation's own order. */
	exploreStep(direction: -1 | 1): boolean {
		const presentation = this.currentPresentation;
		const index = this.state.viewIndex;
		if (presentation === null || index === null) return false;
		const viewId = presentation.viewIds[index + direction];
		return viewId === undefined ? false : this.exploreView(viewId);
	}

	/**
	 * Back to the tour: a Cut to the Stop's View that restores the playhead and the
	 * play, pause or wait state of the same occurrence. Next never returns.
	 */
	resume() {
		this.queuedMotions = [];
		this.pendingMilliseconds = 0;
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
		const firstViewId = previous?.entryViewId;
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
	 * Places: enter a Presentation listed in Places at its Default through the
	 * interpreter's Presentation-entry event. From a Stop or from Explore it keeps
	 * the one resume point; it never fabricates a Stop.
	 */
	selectPresentation(presentationId: string, viewId?: string): boolean {
		if (!this.freePresentations.some((presentation) => presentation.id === presentationId)) return false;
		const result = this.reduce({
			kind: 'enter-presentation',
			...this.runIdentity(),
			presentationId,
			...(viewId === undefined ? {} : { viewId })
		});
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

	/**
	 * Advance the one Guide clock. Ticks are ignored while paused or exploring
	 * (the reducer refuses them too); a stay that ends plays on by itself in
	 * Automatic, and a Manual Stop waits for Next.
	 */
	tick(milliseconds: number) {
		if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
		if (this.state.paused || this.exploring || this.ended) {
			this.pendingMilliseconds = 0;
			return;
		}
		// The interpreter's clock is integer milliseconds. A renderer supplies
		// `delta * 1000` (≈16.67 at 60 fps), so accumulate and dispatch whole
		// milliseconds rather than dropping every fractional frame.
		this.pendingMilliseconds += milliseconds;
		const wholeMilliseconds = Math.floor(this.pendingMilliseconds);
		if (wholeMilliseconds <= 0) return;
		this.pendingMilliseconds -= wholeMilliseconds;
		const ticked = this.reduce({ kind: 'tick', ...this.runIdentity(), milliseconds: wholeMilliseconds });
		this.state = ticked.state;
		this.queuedMotions.push(...this.cameraMotions(ticked.effects));
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
			const viewId = effect.stopId === null
				? (effect.invocation.kind === 'cut' ? effect.invocation.viewId : this.state.viewId)
				: this.program.stops.find((stop) => stop.id === effect.stopId)?.entryViewId ?? null;
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

	/** A Manual Stop waits for Next. */
	get waiting() {
		return this.state.phase === 'ready' && this.state.holdRemainingMs === null && this.state.stopId !== null;
	}

	/** The arrival Travel into the current Stop is playing; its stay has not started. */
	get traveling() {
		return this.state.phase === 'traveling';
	}

	/** Automatic only: the Guide clock is frozen. */
	get paused() {
		return this.state.paused;
	}

	get pacing() {
		return this.program.pacing;
	}

	/** Exploring: a Stop occurrence is suspended behind the visitor's own looking. */
	get exploring(): boolean {
		return this.state.resume !== null;
	}

	/** Whether a suspended Guide position can be returned to. */
	get canResume(): boolean {
		return this.state.resume !== null;
	}

	/** The current Stop's invitation to explore, or null. */
	get invitation() {
		return this.currentStop?.invitation ?? null;
	}

	get companion() {
		return buildExperienceCompanion(this.program, this.state);
	}
}

export function createVisitorRuntimeState(input: VisitorRuntimeInput) {
	return new VisitorRuntimeState(input);
}
