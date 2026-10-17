/**
 * The one Experience interpreter (AM-6, T3.P01.S06).
 *
 * A deterministic reducer over `ExecutionProgram@1`: an initial state plus
 * ordered events produce the same state every time, and an explicit integer
 * clock supplies every hold. There is no ambient time, randomness, network,
 * renderer or Camera evaluation here — the interpreter derives editorial state
 * and emits Camera *intents*, and the Camera authority evaluates pose,
 * projection and route timing.
 *
 * Identity rules:
 *
 * - a Stop is a stable authored occurrence; each visit adds a **fresh run
 *   occurrence identity** (`occurrenceId`), so revisiting a Stop never reuses a
 *   visit;
 * - every event is qualified by `runId` + `runEpoch`; an event from an older run
 *   is rejected (`stale`) and can neither advance, complete nor clear the newer
 *   run;
 * - an `arrival` event only confirms the current occurrence. The Camera intent is
 *   emitted once at editorial arrival, so a confirmation never reissues it, and
 *   a terminal run ignores the confirmation entirely;
 * - state is initialized once per run and reset explicitly, never on every
 *   arrival. A `reset` rewinds the **same** run (`runId`/`runEpoch` unchanged)
 *   to a fresh entry; starting a new run is the host's new-run path, not reset.
 *
 * `traveling`/`arrived` are reserved host phases: the interpreter reports an
 * arrival as `ready`/`holding`/`blocked` and the host owns realization state.
 *
 * The reducer owns no authored source: a run is session state and is never
 * written back to the envelope.
 */

import type {
	ExecutionProgram,
	ProgramAction,
	ProgramEvent,
	ProgramGuard,
	ProgramInvocation,
	ProgramStop
} from '../../program/types';

export type ExperienceRunPhase =
	| 'ready'
	/** Reserved for a host that realizes travel; the reducer never produces it. */
	| 'traveling'
	/** Reserved for a host that stages arrival; the reducer never produces it. */
	| 'arrived'
	| 'holding'
	| 'blocked'
	| 'completed'
	| 'cancelled';

export type ExperiencePanel = {
	readonly presentationId: string;
	readonly title: string;
	readonly content: readonly { readonly id: string; readonly text: string }[];
};

export type ExperienceVisit = {
	readonly stopId: string;
	readonly occurrenceId: string;
	/** One-based visit order within the run. */
	readonly index: number;
};

export type ExperienceRunState = {
	readonly runId: string;
	readonly runEpoch: number;
	/**
	 * The lowering source this run was prepared from, or `null` when the host did
	 * not declare one. A run belongs to exactly one source: dispatching against a
	 * different source is a rebase and every event for the old run is stale.
	 */
	readonly sourceContentId: string | null;
	readonly entered: boolean;
	readonly stopId: string | null;
	readonly occurrenceId: string | null;
	readonly presentationId: string | null;
	readonly phase: ExperienceRunPhase;
	/** Explicit integer clock since the run entered, in milliseconds. */
	readonly elapsedMs: number;
	/** Remaining hold on the current occurrence, or `null` when none is active. */
	readonly holdRemainingMs: number | null;
	/** The current occurrence waits for an explicit Continue (authored Gate). */
	readonly gated: boolean;
	readonly visited: readonly ExperienceVisit[];
	readonly values: Readonly<Record<string, string | boolean>>;
	readonly panel: ExperiencePanel | null;
	/** Content ids a lifecycle `show-content` selected before a panel existed. */
	readonly pendingContent: readonly string[];
	readonly invocation: ProgramInvocation | null;
	/** The origin a covered detour must return to, or `null`. */
	readonly returnToStopId: string | null;
	readonly lastEvent: ProgramEvent | null;
};

export type ExperienceEvent =
	| { readonly kind: 'enter'; readonly runId: string; readonly runEpoch: number }
	| { readonly kind: 'arrival'; readonly runId: string; readonly runEpoch: number }
	| { readonly kind: 'continue'; readonly runId: string; readonly runEpoch: number }
	| { readonly kind: 'complete'; readonly runId: string; readonly runEpoch: number }
	| { readonly kind: 'cancel'; readonly runId: string; readonly runEpoch: number }
	| { readonly kind: 'reset'; readonly runId: string; readonly runEpoch: number }
	| { readonly kind: 'tick'; readonly runId: string; readonly runEpoch: number; readonly milliseconds: number }
	| { readonly kind: 'navigate'; readonly runId: string; readonly runEpoch: number; readonly stopId: string }
	| {
			readonly kind: 'set-state';
			readonly runId: string;
			readonly runEpoch: number;
			readonly stateId: string;
			readonly value: string | boolean;
	  };

export type ExperienceDetourPolicy = {
	readonly fromStopId: string;
	readonly toStopId: string;
	readonly returnToStopId: string;
};

/**
 * One validated runtime edge: the Camera invocation for arriving at `toStopId`
 * **from `fromStopId`**. Lowering derives these for every authored edge, so the
 * invocation a run uses is the one that starts at its actual predecessor, never
 * the Guide-adjacent binding of some other approach.
 */
export type ExperienceTransition = {
	readonly fromStopId: string;
	readonly toStopId: string;
	readonly invocation: ProgramInvocation;
};

export type ExperienceInterpreterOptions = {
	readonly runId: string;
	readonly runEpoch: number;
	/** The lowering source this run belongs to; a differing value ends the run. */
	readonly sourceContentId?: string | null;
	/**
	 * Presentation ids whose arrival waits for an explicit Continue. A Gate is
	 * authored experience policy; it is passed in because `ExecutionProgram@1`
	 * carries no Gate slot.
	 */
	readonly gates?: readonly string[];
	readonly detours?: readonly ExperienceDetourPolicy[];
	/**
	 * Lowering-derived invocation per authored edge. Without a table the run only
	 * trusts a Stop's own invocation for its authored predecessor; any other jump
	 * may Cut, and a Travel without a matching edge is a typed gap.
	 */
	readonly transitions?: readonly ExperienceTransition[];
};

export type ExperienceEffect =
	| { readonly kind: 'camera'; readonly stopId: string; readonly invocation: ProgramInvocation }
	| { readonly kind: 'hold'; readonly stopId: string; readonly milliseconds: number }
	| { readonly kind: 'ready'; readonly stopId: string }
	| { readonly kind: 'blocked'; readonly stopId: string }
	| { readonly kind: 'panel'; readonly panel: ExperiencePanel }
	| { readonly kind: 'open-url'; readonly url: string }
	| { readonly kind: 'completed' }
	| {
			readonly kind: 'gap';
			readonly fromStopId: string | null;
			readonly toStopId: string;
			readonly message: string;
	  };

export type ExperienceReduceOutcome = 'accepted' | 'ignored' | 'stale';

export type ExperienceReduceResult = {
	readonly state: ExperienceRunState;
	readonly outcome: ExperienceReduceOutcome;
	readonly effects: readonly ExperienceEffect[];
};

/** The state before `enter`: no occurrence, values at their declared initial. */
export function createExperienceRun(
	program: ExecutionProgram,
	options: ExperienceInterpreterOptions
): ExperienceRunState {
	const values: Record<string, string | boolean> = {};
	for (const declaration of program.state) values[declaration.id] = declaration.initial;
	return {
		runId: options.runId,
		runEpoch: options.runEpoch,
		sourceContentId: options.sourceContentId ?? null,
		entered: false,
		stopId: null,
		occurrenceId: null,
		presentationId: null,
		phase: 'ready',
		elapsedMs: 0,
		holdRemainingMs: null,
		gated: false,
		visited: [],
		values,
		panel: null,
		pendingContent: [],
		invocation: null,
		returnToStopId: null,
		lastEvent: null
	};
}

/** Fold one event into one run. Pure: the input state is never mutated. */
export function reduceExperience(
	program: ExecutionProgram,
	state: ExperienceRunState,
	event: ExperienceEvent,
	options: ExperienceInterpreterOptions = { runId: state.runId, runEpoch: state.runEpoch }
): ExperienceReduceResult {
	if (!sameRun(state, event)) return { state, outcome: 'stale', effects: [] };
	// A source edit replaces the run: an event prepared from a different lowering
	// source can never advance the old run, nor resurrect state it once held.
	if (
		options.sourceContentId !== undefined &&
		options.sourceContentId !== null &&
		state.sourceContentId !== null &&
		options.sourceContentId !== state.sourceContentId
	) {
		return { state, outcome: 'stale', effects: [] };
	}

	if (event.kind === 'tick') return tick(state, event.milliseconds);
	if (event.kind === 'enter') return enter(program, state, options);
	if (event.kind === 'reset') return resetRun(program, state, options);
	if (event.kind === 'cancel') return finish(program, state, 'cancel', options);
	if (event.kind === 'complete') return finish(program, state, 'complete', options);
	if (event.kind === 'arrival') return arrivalEvent(state);
	if (event.kind === 'set-state') return setState(program, state, event.stateId, event.value);
	if (event.kind === 'navigate') return navigate(program, state, event.stopId, options);
	return continueRun(program, state, options);
}

/** Replay an ordered event list from a fresh run. Seeking replays; it never guesses history. */
export function replayExperience(
	program: ExecutionProgram,
	options: ExperienceInterpreterOptions,
	events: readonly ExperienceEvent[]
): ExperienceReduceResult {
	let state = createExperienceRun(program, options);
	let effects: ExperienceEffect[] = [];
	let outcome: ExperienceReduceOutcome = 'accepted';
	for (const event of events) {
		const result = reduceExperience(program, state, event, options);
		state = result.state;
		effects = [...effects, ...result.effects];
		outcome = result.outcome;
	}
	return { state, outcome, effects };
}

/** A small imperative wrapper over the pure reducer. */
export function createExperienceInterpreter(
	program: ExecutionProgram,
	options: ExperienceInterpreterOptions
) {
	let current = createExperienceRun(program, options);
	return {
		program,
		state: (): ExperienceRunState => current,
		dispatch(event: ExperienceEvent): ExperienceReduceResult {
			const result = reduceExperience(program, current, event, options);
			current = result.state;
			return result;
		},
		enter(): ExperienceReduceResult {
			return this.dispatch({ kind: 'enter', runId: current.runId, runEpoch: current.runEpoch });
		},
		continue(): ExperienceReduceResult {
			return this.dispatch({ kind: 'continue', runId: current.runId, runEpoch: current.runEpoch });
		},
		tick(milliseconds: number): ExperienceReduceResult {
			return this.dispatch({ kind: 'tick', runId: current.runId, runEpoch: current.runEpoch, milliseconds });
		},
		navigate(stopId: string): ExperienceReduceResult {
			return this.dispatch({ kind: 'navigate', runId: current.runId, runEpoch: current.runEpoch, stopId });
		}
	};
}

function sameRun(state: ExperienceRunState, event: ExperienceEvent): boolean {
	return state.runId === event.runId && state.runEpoch === event.runEpoch;
}

function stopById(program: ExecutionProgram, stopId: string): ProgramStop | undefined {
	return program.stops.find((stop) => stop.id === stopId);
}

function enter(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	if (state.entered) return accepted(state, []);
	if (program.entryStopId === null) {
		return {
			state: { ...state, entered: true, phase: 'completed', lastEvent: 'enter' },
			outcome: 'accepted',
			effects: [{ kind: 'completed' }]
		};
	}
	const entered: ExperienceRunState = { ...state, entered: true, lastEvent: 'enter' };
	const effects: ExperienceEffect[] = [];
	// An `enter` cancellation can have no occurrence to continue from yet; only the
	// arrival lifecycle may request a continuation.
	const actioned = applyLifecycle(program, entered, 'enter', effects);
	if (actioned.navigateTo !== null) {
		return arrive(program, actioned.state, actioned.navigateTo, options, effects);
	}
	return arrive(program, actioned.state, program.entryStopId, options, effects);
}

function arrivalEvent(state: ExperienceRunState): ExperienceReduceResult {
	if (state.stopId === null) return ignored(state);
	// A terminal run has already issued every Camera intent it is allowed to; a
	// late confirmation from its old travel must not write to the Camera again.
	if (state.phase === 'completed' || state.phase === 'cancelled') return ignored(state);
	// Confirming an arrival is not a second visit and not a second Camera intent:
	// the occurrence identity stays and the invocation was issued once at editorial
	// arrival. Re-emitting it here would duplicate the one Camera write and could
	// restart a completed travel.
	return accepted({ ...state, lastEvent: 'arrival' }, []);
}

/**
 * Resolve the invocation for the actual approach. A transition table entry wins;
 * the Stop's own binding is trusted only for its authored predecessor. A Cut
 * needs no route, but a Travel must never borrow a connection that starts
 * somewhere else.
 */
function invocationFor(
	program: ExecutionProgram,
	state: ExperienceRunState,
	stopId: string,
	stop: ProgramStop,
	options: ExperienceInterpreterOptions
): { readonly kind: 'resolved'; readonly invocation: ProgramInvocation } | { readonly kind: 'gap'; readonly message: string } {
	const predecessor = state.stopId;
	if (predecessor === null) return { kind: 'resolved', invocation: stop.invocation };
	const transition = (options.transitions ?? []).find(
		(entry) => entry.fromStopId === predecessor && entry.toStopId === stopId
	);
	if (transition !== undefined) return { kind: 'resolved', invocation: transition.invocation };
	const index = program.stops.findIndex((entry) => entry.id === stopId);
	const authoredPredecessor = index > 0 ? program.stops[index - 1]!.id : null;
	if (authoredPredecessor === predecessor) return { kind: 'resolved', invocation: stop.invocation };
	if (stop.invocation.kind === 'cut') return { kind: 'resolved', invocation: stop.invocation };
	return {
		kind: 'gap',
		message: `arriving at Stop "${stopId}" from "${predecessor}" has no resolved Camera transition; its bound Travel starts from "${authoredPredecessor ?? 'the entry'}"`
	};
}

/**
 * Arrive at a Stop occurrence: a fresh occurrence identity, the Presentation's
 * panel, its invocation intent, and one of ready/holding/blocked.
 */
function arrive(
	program: ExecutionProgram,
	state: ExperienceRunState,
	stopId: string,
	options: ExperienceInterpreterOptions,
	effects: ExperienceEffect[],
	appendVisit = true,
	depth = 0,
	continueDepth = 0
): ExperienceReduceResult {
	if (depth > 8) {
		return {
			state,
			outcome: 'ignored',
			effects: [...effects, {
				kind: 'gap',
				fromStopId: state.stopId,
				toStopId: stopId,
				message: 'the arrival lifecycle redirects too many times'
			}]
		};
	}
	const stop = stopById(program, stopId);
	if (stop === undefined) {
		return { state, outcome: 'ignored', effects: [...effects, {
			kind: 'gap',
			fromStopId: state.stopId,
			toStopId: stopId,
			message: `the program carries no Stop "${stopId}"`
		}] };
	}
	const presentation = program.presentations.find((entry) => entry.id === stop.presentationId);
	if (presentation === undefined) {
		return { state, outcome: 'ignored', effects: [...effects, {
			kind: 'gap',
			fromStopId: state.stopId,
			toStopId: stopId,
			message: `Stop "${stopId}" names no Presentation`
		}] };
	}
	// The invocation must be valid for the approach this run actually made. A
	// Travel bound to another predecessor is a typed gap: the run does not arrive
	// and no Camera intent is emitted.
	const resolvedInvocation = invocationFor(program, state, stopId, stop, options);
	if (resolvedInvocation.kind === 'gap') {
		return {
			state,
			outcome: 'ignored',
			effects: [...effects, {
				kind: 'gap',
				fromStopId: state.stopId,
				toStopId: stopId,
				message: resolvedInvocation.message
			}]
		};
	}
	const invocation = resolvedInvocation.invocation;
	const visit: ExperienceVisit = {
		stopId,
		occurrenceId: `${state.runId}:${stopId}:${state.visited.length + 1}`,
		index: state.visited.length + 1
	};
	// A `show-content` selected before this arrival (an `enter` lifecycle action, or
	// an arrival action that ran before the panel existed) narrows the panel to the
	// selected records. The selection is consumed once, here, so a later Stop shows
	// its own full Presentation.
	const matchedSelection = state.pendingContent.length === 0
		? presentation.content
		: presentation.content.filter((record) => state.pendingContent.includes(record.id));
	// A selection that names only another Presentation's content must not blank the
	// panel: the arrival shows its own full Presentation and reports the foreign id
	// as a gap below. A partially matching selection still narrows as declared.
	const selected = matchedSelection.length === 0 ? presentation.content : matchedSelection;
	// A selection that belongs to another Presentation cannot silently narrow this
	// panel to nothing: the arrival still happens and the unconsumed selection is
	// reported as a typed gap for the host/companion to explain.
	const outsideSelection = state.pendingContent.filter(
		(contentId) => !presentation.content.some((record) => record.id === contentId)
	);
	const panel: ExperiencePanel = {
		presentationId: presentation.id,
		title: presentation.label,
		content: selected.map((record) => ({ id: record.id, text: record.text }))
	};
	const gated = (options.gates ?? []).includes(presentation.id);
	const base: ExperienceRunState = {
		...state,
		stopId,
		occurrenceId: visit.occurrenceId,
		presentationId: presentation.id,
		visited: appendVisit ? [...state.visited, visit] : state.visited,
		panel,
		pendingContent: [],
		invocation,
		gated,
		holdRemainingMs: null,
		phase: 'ready',
		lastEvent: 'arrival'
	};
	const nextEffects: ExperienceEffect[] = [
		...effects,
		{ kind: 'camera', stopId, invocation },
		{ kind: 'panel', panel }
	];
	for (const contentId of outsideSelection) {
		nextEffects.push({
			kind: 'gap',
			fromStopId: state.stopId,
			toStopId: stopId,
			message: `show-content selected "${contentId}", which Presentation "${presentation.id}" does not carry`
		});
	}
	const actioned = applyLifecycle(program, base, 'arrival', nextEffects);
	if (actioned.navigateTo !== null && actioned.navigateTo !== stopId) {
		return arrive(program, actioned.state, actioned.navigateTo, options, nextEffects, true, depth + 1);
	}
	let result = actioned.state;
	const holdSeconds = stop.holdSeconds;
	if (holdSeconds !== null && holdSeconds > 0) {
		result = { ...result, phase: 'holding', holdRemainingMs: Math.round(holdSeconds * 1000) };
		nextEffects.push({ kind: 'hold', stopId, milliseconds: result.holdRemainingMs! });
	} else if (gated) {
		result = { ...result, phase: 'blocked' };
		nextEffects.push({ kind: 'blocked', stopId });
	} else {
		nextEffects.push({ kind: 'ready', stopId });
	}
	// A lifecycle `continue` resolves the occurrence exactly once, and only when the
	// occurrence is actually ready: a hold is time and a Gate is a prompt, so neither
	// is skipped by the action.
	if (actioned.continueRequested && result.phase === 'ready') {
		return advance(program, result, options, nextEffects, continueDepth);
	}
	return { state: result, outcome: 'accepted', effects: nextEffects };
}

function tick(state: ExperienceRunState, milliseconds: number): ExperienceReduceResult {
	if (!Number.isInteger(milliseconds) || milliseconds < 0) return ignored(state);
	const elapsedMs = state.elapsedMs + milliseconds;
	if (state.phase !== 'holding' || state.holdRemainingMs === null || state.stopId === null) {
		return { state: { ...state, elapsedMs }, outcome: 'accepted', effects: [] };
	}
	const remaining = state.holdRemainingMs - milliseconds;
	if (remaining > 0) {
		return {
			state: { ...state, elapsedMs, holdRemainingMs: remaining },
			outcome: 'accepted',
			effects: []
		};
	}
	const phase: ExperienceRunPhase = state.gated ? 'blocked' : 'ready';
	const effects: ExperienceEffect[] = [
		phase === 'blocked'
			? { kind: 'blocked', stopId: state.stopId }
			: { kind: 'ready', stopId: state.stopId }
	];
	return {
		state: { ...state, elapsedMs, holdRemainingMs: 0, phase },
		outcome: 'accepted',
		effects
	};
}

function continueRun(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	if (state.phase === 'completed' || state.phase === 'cancelled') return ignored(state);
	if (state.phase === 'holding') {
		// A hold is time, not a prompt: Continue during it changes nothing.
		return ignored(state);
	}
	if (state.stopId === null) return ignored(state);
	// Continue is an action, not a run-scoped program event. The lifecycle actions
	// were already applied on arrival; continuing resolves this occurrence's
	// continuation exactly once.
	const effects: ExperienceEffect[] = [];
	return advance(program, state, options, effects);
}

/** Resolve the occurrence's continuation once, by occurrence identity. */
function advance(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions,
	effects: ExperienceEffect[],
	continueDepth = 0
): ExperienceReduceResult {
	if (state.stopId === null) return ignored(state);
	if (continueDepth > 8) {
		return {
			state,
			outcome: 'ignored',
			effects: [...effects, {
				kind: 'gap',
				fromStopId: state.stopId,
				toStopId: state.stopId,
				message: 'the arrival lifecycle continues too many times'
			}]
		};
	}
	const stop = stopById(program, state.stopId);
	if (stop === undefined) return ignored(state);
	const continuation = stop.continuation;

	// A covered detour is an excursion: finishing the detour occurrence returns to
	// the origin occurrence before **any** continuation kind is resolved, including
	// sequence-next and an explicit Stop target. Otherwise the run would follow the
	// detour target's own continuation and never discharge the return obligation.
	if (state.returnToStopId !== null) {
		const origin = state.returnToStopId;
		const returned = arrive(program, state, origin, options, effects, true, 0, continueDepth + 1);
		// The obligation is discharged only once the origin arrival actually happened;
		// a gapped return (for example a missing transition in a partial table) leaves
		// the run at the detour target with its return still owed.
		return returned.outcome === 'ignored'
			? returned
				: { ...returned, state: { ...returned.state, returnToStopId: null } };
	}

	if (continuation.kind === 'end') {
		return finish(program, state, 'complete', options, effects);
	}
	if (continuation.kind === 'stop') {
		return arrive(program, { ...state, returnToStopId: null }, continuation.stopId, options, effects, true, 0, continueDepth + 1);
	}
	const index = program.stops.findIndex((entry) => entry.id === state.stopId);
	const next = index >= 0 ? program.stops[index + 1] : undefined;
	if (next === undefined) {
		return finish(program, state, 'complete', options, effects);
	}
	return arrive(program, state, next.id, options, effects, true, 0, continueDepth + 1);
}

function navigate(
	program: ExecutionProgram,
	state: ExperienceRunState,
	stopId: string,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	if (stopById(program, stopId) === undefined) return ignored(state);
	if (state.phase === 'completed' || state.phase === 'cancelled') return ignored(state);
	// A detour inside an excursion would overwrite the outer return obligation and
	// strand the run at the inner origin. The outer excursion wins: navigate to the
// target but keep the obligation that is already owed.
	if (state.returnToStopId !== null) {
		return arrive(program, state, stopId, options, []);
	}
	const detour = (options.detours ?? []).find(
		(entry) => entry.fromStopId === state.stopId && entry.toStopId === stopId
	);
	const next: ExperienceRunState = detour === undefined
		? { ...state, returnToStopId: null }
		: { ...state, returnToStopId: detour.returnToStopId };
	return arrive(program, next, stopId, options, []);
}

function setState(
	program: ExecutionProgram,
	state: ExperienceRunState,
	stateId: string,
	value: string | boolean
): ExperienceReduceResult {
	const declaration = program.state.find((entry) => entry.id === stateId);
	if (declaration === undefined) return ignored(state);
	const valid = declaration.type === 'boolean'
		? typeof value === 'boolean'
		: typeof value === 'string' && declaration.values.includes(value);
	if (!valid) return ignored(state);
	return {
		state: { ...state, values: { ...state.values, [stateId]: value } },
		outcome: 'accepted',
		effects: []
	};
}

function resetRun(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	const values: Record<string, string | boolean> = {};
	for (const declaration of program.state) values[declaration.id] = declaration.reset;
	const reset: ExperienceRunState = {
		...state,
		entered: false,
		stopId: null,
		occurrenceId: null,
		presentationId: null,
		phase: 'ready',
		elapsedMs: 0,
		holdRemainingMs: null,
		gated: false,
		visited: [],
		values,
		panel: null,
		pendingContent: [],
		invocation: null,
		returnToStopId: null,
		lastEvent: null
	};
	return enter(program, reset, options);
}

function finish(
	program: ExecutionProgram,
	state: ExperienceRunState,
	event: 'complete' | 'cancel',
	options: ExperienceInterpreterOptions,
	effects: ExperienceEffect[] = []
): ExperienceReduceResult {
	const actioned = applyLifecycle(program, state, event, effects);
	const phase: ExperienceRunPhase = event === 'complete' ? 'completed' : 'cancelled';
	const values = event === 'cancel'
		? Object.fromEntries(program.state.map((declaration) => [declaration.id, declaration.reset]))
		: actioned.state.values;
	// A `navigate-to` in a complete/cancel lifecycle is deliberately not followed:
	// the run has ended, so the declared navigation has no occurrence to reach. The
	// obligation is cleared with the run instead of leaving a stale redirect.
	return {
		state: {
			...actioned.state,
			phase,
			values,
			holdRemainingMs: null,
			returnToStopId: null,
			pendingContent: []
		},
		outcome: 'accepted',
		effects: event === 'complete' ? [...effects, { kind: 'completed' }] : effects
	};
}

type LifecycleApplication = {
	readonly state: ExperienceRunState;
	readonly navigateTo: string | null;
	/** An applied `continue` action asked this occurrence to resolve its continuation. */
	readonly continueRequested: boolean;
};

/**
 * Apply one event's lifecycle actions in declared order. Guards read the state
 * produced by earlier actions in the same list, so `set-state` before a guarded
 * action is meaningful; nothing here evaluates a domain expression.
 */
function applyLifecycle(
	program: ExecutionProgram,
	state: ExperienceRunState,
	event: ProgramEvent,
	effects: ExperienceEffect[]
): LifecycleApplication {
	let current = state;
	let navigateTo: string | null = null;
	let continueRequested = false;
	for (const entry of program.lifecycle) {
		if (entry.event !== event) continue;
		if (entry.guard !== null && !evaluateGuard(entry.guard, current.values)) continue;
		const applied = applyAction(program, current, entry.action, effects);
		current = applied.state;
		if (applied.navigateTo !== null) navigateTo = applied.navigateTo;
		if (applied.continueRequested) continueRequested = true;
	}
	return { state: current, navigateTo, continueRequested };
}

function applyAction(
	program: ExecutionProgram,
	state: ExperienceRunState,
	action: ProgramAction,
	effects: ExperienceEffect[]
): LifecycleApplication {
	switch (action.kind) {
		case 'show-content': {
			if (state.panel === null) {
				// The panel does not exist yet: queue the selection for the arrival that
				// creates it instead of dropping the declared action. Ownership is checked
				// against the arriving Presentation then, so a pre-arrival selection cannot
				// be steered by whatever Presentation happens to carry the id.
				const queued = program.presentations
					.flatMap((presentation) => presentation.content)
					.find((entry) => entry.id === action.contentId);
				if (queued === undefined) return { state, navigateTo: null, continueRequested: false };
				return {
					state: { ...state, pendingContent: [...state.pendingContent, queued.id] },
					navigateTo: null,
					continueRequested: false
				};
			}
			// An open panel belongs to exactly one Presentation. A content record from
			// another Presentation is a typed gap, never content placed under the wrong
			// label and View.
			const active = program.presentations.find((presentation) => presentation.id === state.presentationId);
			const record = active?.content.find((entry) => entry.id === action.contentId);
			if (record === undefined) {
				const livedElsewhere = program.presentations.some(
					(presentation) => presentation.id !== state.presentationId &&
						presentation.content.some((entry) => entry.id === action.contentId)
				);
				if (livedElsewhere) {
					effects.push({
						kind: 'gap',
						fromStopId: state.stopId,
						toStopId: state.stopId ?? '',
						message: `show-content selected "${action.contentId}", which the active Presentation does not carry`
					});
				}
				return { state, navigateTo: null, continueRequested: false };
			}
			const panel: ExperiencePanel = { ...state.panel, content: [{ id: record.id, text: record.text }] };
			effects.push({ kind: 'panel', panel });
			return { state: { ...state, panel }, navigateTo: null, continueRequested: false };
		}
		case 'navigate-to':
			return { state, navigateTo: action.stopId, continueRequested: false };
		case 'open-url':
			// The effect is the contract; there is no second state field a host could
			// read and fire the URL again.
			effects.push({ kind: 'open-url', url: action.url });
			return { state, navigateTo: null, continueRequested: false };
		case 'continue':
			// `continue` is resolved by the arrival that applied this action; on any
			// other event (enter/complete/cancel) there is no occurrence to advance and
			// the action is ignored rather than silently pretending to act.
			return { state, navigateTo: null, continueRequested: true };
		case 'set-state':
			return {
				state: { ...state, values: { ...state.values, [action.stateId]: action.value } },
				navigateTo: null,
				continueRequested: false
			};
	}
}

function evaluateGuard(guard: ProgramGuard, values: Readonly<Record<string, string | boolean>>): boolean {
	switch (guard.kind) {
		case 'literal':
			return guard.value;
		case 'state':
			return values[guard.stateId] === true;
		case 'equals':
			return values[guard.stateId] === guard.value;
		case 'conjunction':
			return guard.guards.every((entry) => evaluateGuard(entry, values));
	}
}

function accepted(state: ExperienceRunState, effects: readonly ExperienceEffect[]): ExperienceReduceResult {
	return { state, outcome: 'accepted', effects };
}

function ignored(state: ExperienceRunState): ExperienceReduceResult {
	return { state, outcome: 'ignored', effects: [] };
}
