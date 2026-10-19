/**
 * Visitor runtime — Experience-unit orchestration (AM-9, T3.P01.S04).
 *
 * The visitor executes one lowered `ExecutionProgram@1` through the single
 * Experience interpreter. There is no node-keyed order, no main-flow walk and no
 * Scene `nextNodeId`/`previousNodeId` traversal: Guide order is authored in the
 * Experience unit, lowering produces the program, and this store only dispatches
 * explicit events at editorial arrival. Camera framing is read from the current
 * Stop's Presentation view; motion remains the Camera authority's.
 */
import {
	buildExperienceCompanion,
	createExperienceInterpreter,
	type ExecutionProgram,
	type ExperienceInterpreterOptions,
	type ExperienceRunState,
	type ProgramInvocation
} from '@portfolio/project-model/units';

export type VisitorRuntimeInput = {
	readonly program: ExecutionProgram;
	readonly options: ExperienceInterpreterOptions;
};

export class VisitorRuntimeState {
	readonly program: ExecutionProgram;
	readonly options: ExperienceInterpreterOptions;
	/** Set by the host from `prefers-reduced-motion`; affects camera motion only. */
	reducedMotion = $state(false);
	/** A Stop-free Presentation selected through the visitor's DOM navigation. */
	selectedPresentationId = $state<string | null>(null);
	state: ExperienceRunState;

	private readonly interpreter: ReturnType<typeof createExperienceInterpreter>;
	/** Fractional frame milliseconds carried until they form one interpreter tick. */
	private pendingMilliseconds = 0;

	constructor({ program, options }: VisitorRuntimeInput) {
		this.program = program;
		this.options = options;
		this.interpreter = createExperienceInterpreter(program, options);
		this.state = $state(this.interpreter.state());
	}

	/** Enter the Experience at its authored entry Stop. Idempotent. */
	enter() {
		this.selectedPresentationId = null;
		this.state = this.interpreter.enter().state;
	}

	/** The explicit Continue control. A Gate or a finished hold advances once. */
	continue() {
		const before = this.state;
		const next = this.interpreter.continue().state;
		this.state = next;
		// Continue during a hold is ignored by the interpreter. Only an actual
		// advance returns the visitor from a detached Presentation to the Guide;
		// a no-op keypress must not yank the selected View away.
		if (next !== before) this.selectedPresentationId = null;
	}

	/** An explicit authored destination; the Guide is never bypassed by this. */
	navigate(stopId: string) {
		this.selectedPresentationId = null;
		this.state = this.interpreter.navigate(stopId).state;
	}

	/**
	 * Select a Presentation that carries no Stop. It realizes the Presentation's
	 * View through the same Camera authority and never fabricates a Stop.
	 */
	selectPresentation(presentationId: string): boolean {
		if (!this.program.presentations.some((presentation) => presentation.id === presentationId)) {
			return false;
		}
		this.selectedPresentationId = presentationId;
		return true;
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
		this.state = this.interpreter.tick(wholeMilliseconds).state;
		// A hold is time, not a prompt: when the authored hold expires the run
		// continues itself. A Gate is different and stays blocked until the
		// visitor's explicit Continue.
		if (wasHolding && this.state.phase === 'ready' && !this.state.gated) this.continue();
	}

	get currentStop() {
		return this.state.stopId === null
			? null
			: this.program.stops.find((stop) => stop.id === this.state.stopId) ?? null;
	}

	get currentPresentation() {
		if (this.selectedPresentationId !== null) {
			return this.program.presentations.find(
				(presentation) => presentation.id === this.selectedPresentationId
			) ?? null;
		}
		const stop = this.currentStop;
		return stop === null
			? null
			: this.program.presentations.find((presentation) => presentation.id === stop.presentationId) ?? null;
	}

	/** The Camera view the current Stop's Presentation names, or `null`. */
	get currentViewId(): string | null {
		return this.currentPresentation?.viewId ?? null;
	}

	get currentInvocation(): ProgramInvocation | null {
		// A Stop-free Presentation has no authored connection: selecting it is a
		// Cut through the same Camera authority. The interpreter's last invocation
		// belongs to the Stop the visitor left, so it must not be replayed here.
		if (this.selectedPresentationId !== null) {
			const viewId = this.currentViewId;
			return viewId === null ? null : { kind: 'cut', viewId };
		}
		return this.state.invocation;
	}

	get ended() {
		return this.state.phase === 'completed' || this.state.phase === 'cancelled';
	}

	get companion() {
		return buildExperienceCompanion(this.program, this.state);
	}
}

export function createVisitorRuntimeState(input: VisitorRuntimeInput) {
	return new VisitorRuntimeState(input);
}
