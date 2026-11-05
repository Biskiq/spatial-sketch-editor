/**
 * The one Experience interpreter (AM-6, T3.P01.S06).
 *
 * A deterministic reducer over `ExecutionProgram@4`: an initial state plus
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
 * Guide clock (sheet §31): a Stop's stay counts only after its arrival
 * completes. An arrival by Travel is `traveling` until the host confirms it with
 * `arrival` (or Next lands it now with a Cut); then the Stop `holding`s for its
 * stay (Automatic) and plays on, or waits `ready` for Next (Manual). Pause and
 * Explore freeze the clock: ticks are ignored. Explore keeps the Stop occurrence
 * suspended, and `resume` restores it — the same occurrence, the remaining stay
 * (with a lead-in) and the play or pause state — as a Cut, never a fresh arrival.
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
	ProgramPresentation,
	ProgramStop
} from '../../program/types';

export type ExperienceRunPhase =
	| 'ready'
	/** An arrival Travel is playing; the stay has not started yet. */
	| 'traveling'
	/** Reserved for a host that stages arrival; the reducer never produces it. */
	| 'arrived'
	| 'holding'
	| 'completed'
	| 'cancelled';

/** The lead-in a resumed stay keeps, so the tour never leaves the moment a visitor rejoins. */
export const EXPERIENCE_RESUME_LEAD_IN_MS = 2000;

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

/**
 * A Stop occurrence that Explore suspended. `resume` restores exactly this: the
 * same occurrence, its View, the remaining stay (or the wait) and whether the
 * tour was paused. There is one resume point however many Presentations the
 * visitor opens.
 */
export type ExperienceSuspendedVisit = {
	readonly stopId: string;
	readonly occurrenceId: string;
	readonly viewId: string;
	/** Remaining stay in milliseconds, or `null` when the Stop was waiting for Next. */
	readonly holdRemainingMs: number | null;
	readonly paused: boolean;
	readonly returnToStopId: string | null;
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
	/** The current Camera View, or `null` before any arrival. */
	readonly viewId: string | null;
	/** Zero-based index of the current View in its Presentation's order, or `null`. */
	readonly viewIndex: number | null;
	readonly phase: ExperienceRunPhase;
	/** Explicit integer Guide clock since the run entered, in milliseconds. */
	readonly elapsedMs: number;
	/** Remaining stay on the current occurrence, or `null` when none is running. */
	readonly holdRemainingMs: number | null;
	/** Automatic pacing only: the Guide clock is frozen until Play or Next. */
	readonly paused: boolean;
	readonly visited: readonly ExperienceVisit[];
	readonly values: Readonly<Record<string, string | boolean>>;
	readonly panel: ExperiencePanel | null;
	/** Content ids a lifecycle `show-content` selected before a panel existed. */
	readonly pendingContent: readonly string[];
	readonly invocation: ProgramInvocation | null;
	/** The logical predecessor of a Travel. */
	readonly invocationFromViewId: string | null;
	/** The origin a covered detour must return to, or `null`. */
	readonly returnToStopId: string | null;
	/**
	 * The Stop occurrence Explore suspended, or `null`. Only the explicit `resume`
	 * event returns to it; Next never does.
	 */
	readonly resume: ExperienceSuspendedVisit | null;
	readonly lastEvent: ProgramEvent | null;
};

type RunEvent<K extends string> = { readonly kind: K; readonly runId: string; readonly runEpoch: number };

export type ExperienceEvent =
	| RunEvent<'enter'>
	/**
	 * Enter one Presentation to explore it. From a Stop it keeps that occurrence
	 * suspended (landing an arrival Travel first); from nothing it is the
	 * guide-free Places path. It starts at `viewId` when that is one of the
	 * Presentation's Views, else at its Default, and never fabricates a Stop.
	 */
	| (RunEvent<'enter-presentation'> & { readonly presentationId: string; readonly viewId?: string })
	/** Step to one View of the explored Presentation: its authored step when adjacent, else a Cut. */
	| (RunEvent<'explore-view'> & { readonly viewId: string })
	/** Confirms the current arrival; after an arrival Travel it starts the stay. */
	| RunEvent<'arrival'>
	/** Next: lands an arrival now, ends a stay, or continues a wait; it also resumes play. */
	| RunEvent<'continue'>
	| RunEvent<'pause'>
	| RunEvent<'play'>
	/** Back to the tour: restore the suspended occurrence with its lead-in. */
	| RunEvent<'resume'>
	| RunEvent<'complete'>
	| RunEvent<'cancel'>
	| RunEvent<'reset'>
	| (RunEvent<'tick'> & { readonly milliseconds: number })
	| (RunEvent<'navigate'> & { readonly stopId: string })
	| (RunEvent<'set-state'> & { readonly stateId: string; readonly value: string | boolean });

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
	readonly detours?: readonly ExperienceDetourPolicy[];
	/**
	 * Lowering-derived invocation per authored edge. Without a table the run only
	 * trusts a Stop's own invocation for its authored predecessor; any other jump
	 * may Cut, and a Travel without a matching edge is a typed gap.
	 */
	readonly transitions?: readonly ExperienceTransition[];
};

export type ExperienceEffect =
	| {
			readonly kind: 'camera';
			/** `null` while exploring a Presentation, which has no Stop occurrence. */
			readonly stopId: string | null;
			readonly invocation: ProgramInvocation;
	  }
	| { readonly kind: 'hold'; readonly stopId: string; readonly milliseconds: number }
	| { readonly kind: 'ready'; readonly stopId: string | null }
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
		viewId: null,
		viewIndex: null,
		phase: 'ready',
		elapsedMs: 0,
		holdRemainingMs: null,
		paused: false,
		visited: [],
		values,
		panel: null,
		pendingContent: [],
		invocation: null,
		invocationFromViewId: null,
		returnToStopId: null,
		resume: null,
		lastEvent: null
	};
}

/** Whether a run is exploring: a Stop occurrence is suspended behind it. */
export function isExploring(state: ExperienceRunState): boolean {
	return state.resume !== null;
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
	// A terminal run is finished: no lifecycle action, stay, state write or
	// navigation may run again, and a late complete/cancel cannot resurrect it or
	// flip one terminal phase into the other. `reset` is the explicit rewind and
	// is the only event admitted here; it deliberately runs the `enter` lifecycle
	// again on the same run.
	if ((state.phase === 'completed' || state.phase === 'cancelled') && event.kind !== 'reset') {
		return ignored(state);
	}

	switch (event.kind) {
		case 'tick':
			return tick(program, state, event.milliseconds, options);
		case 'enter':
			return enter(program, state, options);
		case 'enter-presentation':
			return enterPresentation(program, state, event.presentationId, event.viewId);
		case 'explore-view':
			return exploreView(program, state, event.viewId);
		case 'reset':
			return resetRun(program, state, options);
		case 'cancel':
			return finish(program, state, 'cancel', options);
		case 'complete':
			return finish(program, state, 'complete', options);
		case 'arrival':
			return arrivalEvent(program, state);
		case 'pause':
			return setPaused(program, state, true);
		case 'play':
			return setPaused(program, state, false);
		case 'set-state':
			return setState(program, state, event.stateId, event.value);
		case 'navigate':
			return navigate(program, state, event.stopId, options);
		case 'resume':
			return resumeGuide(program, state);
		case 'continue':
			return continueRun(program, state, options);
	}
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
	const run = <K extends ExperienceEvent['kind']>(kind: K) =>
		({ kind, runId: current.runId, runEpoch: current.runEpoch }) as Extract<ExperienceEvent, { kind: K }>;
	return {
		program,
		state: (): ExperienceRunState => current,
		dispatch(event: ExperienceEvent): ExperienceReduceResult {
			const result = reduceExperience(program, current, event, options);
			current = result.state;
			return result;
		},
		enter(): ExperienceReduceResult {
			return this.dispatch(run('enter'));
		},
		enterPresentation(presentationId: string, viewId?: string): ExperienceReduceResult {
			return this.dispatch({
				...run('enter-presentation'),
				presentationId,
				...(viewId === undefined ? {} : { viewId })
			});
		},
		exploreView(viewId: string): ExperienceReduceResult {
			return this.dispatch({ ...run('explore-view'), viewId });
		},
		arrival(): ExperienceReduceResult {
			return this.dispatch(run('arrival'));
		},
		continue(): ExperienceReduceResult {
			return this.dispatch(run('continue'));
		},
		pause(): ExperienceReduceResult {
			return this.dispatch(run('pause'));
		},
		play(): ExperienceReduceResult {
			return this.dispatch(run('play'));
		},
		resume(): ExperienceReduceResult {
			return this.dispatch(run('resume'));
		},
		tick(milliseconds: number): ExperienceReduceResult {
			return this.dispatch({ ...run('tick'), milliseconds });
		},
		navigate(stopId: string): ExperienceReduceResult {
			return this.dispatch({ ...run('navigate'), stopId });
		}
	};
}

function sameRun(state: ExperienceRunState, event: ExperienceEvent): boolean {
	return state.runId === event.runId && state.runEpoch === event.runEpoch;
}

function stopById(program: ExecutionProgram, stopId: string): ProgramStop | undefined {
	return program.stops.find((stop) => stop.id === stopId);
}

function presentationById(program: ExecutionProgram, presentationId: string | null): ProgramPresentation | undefined {
	return presentationId === null ? undefined : program.presentations.find((entry) => entry.id === presentationId);
}

function fullPanel(presentation: ProgramPresentation): ExperiencePanel {
	return {
		presentationId: presentation.id,
		title: presentation.label,
		content: presentation.content.map((record) => ({ id: record.id, text: record.text }))
	};
}

function stayMs(stop: ProgramStop): number | null {
	return stop.staySeconds === null ? null : Math.round(stop.staySeconds * 1000);
}

function enter(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	if (state.entered) return accepted(state, []);
	if (program.entryStopId === null) {
		return {
			state: { ...state, entered: true, resume: null, phase: 'completed', lastEvent: 'enter' },
			outcome: 'accepted',
			effects: [{ kind: 'completed' }]
		};
	}
	const entered: ExperienceRunState = { ...state, entered: true, resume: null, paused: false, lastEvent: 'enter' };
	const effects: ExperienceEffect[] = [];
	// An `enter` cancellation can have no occurrence to continue from yet; only the
	// arrival lifecycle may request a continuation.
	const actioned = applyLifecycle(program, entered, 'enter', effects);
	if (actioned.navigateTo !== null) {
		return arrive(program, actioned.state, actioned.navigateTo, options, effects);
	}
	return arrive(program, actioned.state, program.entryStopId, options, effects);
}

/**
 * Explore one Presentation. This is the interpreter's Presentation-entry event,
 * not a host-side shortcut.
 *
 * From a Stop the occurrence is suspended, never cleared: its View, remaining
 * stay (or wait) and play state are kept for `resume`. Explore during an arrival
 * Travel lands first — the suspended occurrence is at its entry View with its
 * whole stay — so coming back always lands on an authored View. Moving between
 * Presentations keeps the one resume point. Exploring freezes the Guide clock.
 */
function enterPresentation(
	program: ExecutionProgram,
	state: ExperienceRunState,
	presentationId: string,
	viewId: string | undefined
): ExperienceReduceResult {
	const presentation = presentationById(program, presentationId);
	if (presentation === undefined) return ignored(state);
	const startViewId = viewId !== undefined && presentation.viewIds.includes(viewId) ? viewId : presentation.viewIds[0]!;
	let resume = state.resume;
	if (state.stopId !== null && state.occurrenceId !== null) {
		const stop = stopById(program, state.stopId)!;
		const landed = state.phase === 'traveling';
		resume = {
			stopId: state.stopId,
			occurrenceId: state.occurrenceId,
			viewId: landed ? stop.entryViewId : state.viewId ?? stop.entryViewId,
			holdRemainingMs: landed ? stayMs(stop) : state.phase === 'holding' ? state.holdRemainingMs : null,
			paused: state.paused,
			returnToStopId: state.returnToStopId
		};
	}
	const panel = fullPanel(presentation);
	const invocation: ProgramInvocation = { kind: 'cut', viewId: startViewId };
	const next: ExperienceRunState = {
		...state,
		entered: true,
		resume,
		stopId: null,
		occurrenceId: null,
		presentationId: presentation.id,
		viewId: startViewId,
		viewIndex: presentation.viewIds.indexOf(startViewId),
		phase: 'ready',
		holdRemainingMs: null,
		paused: false,
		panel,
		pendingContent: [],
		invocation,
		invocationFromViewId: null,
		returnToStopId: null,
		lastEvent: 'arrival'
	};
	return accepted(next, [
		{ kind: 'camera', stopId: null, invocation },
		{ kind: 'panel', panel },
		{ kind: 'ready', stopId: null }
	]);
}

/**
 * Step to one View of the explored Presentation. A neighbour plays the
 * Presentation's authored step (a Travel runs its path in either direction);
 * any other pick is a Cut, because Experience never routes through the Camera
 * graph. Steps add no Guide time.
 */
function exploreView(program: ExecutionProgram, state: ExperienceRunState, viewId: string): ExperienceReduceResult {
	if (state.stopId !== null) return ignored(state);
	const presentation = presentationById(program, state.presentationId);
	if (presentation === undefined || state.viewId === null) return ignored(state);
	const to = presentation.viewIds.indexOf(viewId);
	const from = presentation.viewIds.indexOf(state.viewId);
	if (to === -1 || to === from) return ignored(state);
	const step = from === -1
		? null
		: to === from + 1
			? presentation.steps[from]
			: to === from - 1
				? presentation.steps[to]
				: null;
	const invocation: ProgramInvocation = step?.kind === 'travel' ? step : { kind: 'cut', viewId };
	return accepted(
		{
			...state,
			viewId,
			viewIndex: to,
			invocation,
			invocationFromViewId: invocation.kind === 'travel' ? state.viewId : null
		},
		[{ kind: 'camera', stopId: null, invocation }]
	);
}

function arrivalEvent(program: ExecutionProgram, state: ExperienceRunState): ExperienceReduceResult {
	if (state.stopId === null) return ignored(state);
	// The arrival Travel completed: the stay starts now, never during the Travel.
	if (state.phase === 'traveling') {
		const effects: ExperienceEffect[] = [];
		const stop = stopById(program, state.stopId)!;
		return accepted(beginStay({ ...state, lastEvent: 'arrival' }, stop, effects), effects);
	}
	// Confirming a Cut arrival is not a second visit and not a second Camera
	// intent: the occurrence identity stays and the invocation was issued once.
	return accepted({ ...state, lastEvent: 'arrival' }, []);
}

/** Start the stay (Automatic) or the wait for Next (Manual) of an arrived Stop. */
function beginStay(state: ExperienceRunState, stop: ProgramStop, effects: ExperienceEffect[]): ExperienceRunState {
	const milliseconds = stayMs(stop);
	if (milliseconds === null) {
		effects.push({ kind: 'ready', stopId: stop.id });
		return { ...state, phase: 'ready', holdRemainingMs: null };
	}
	effects.push({ kind: 'hold', stopId: stop.id, milliseconds });
	return { ...state, phase: 'holding', holdRemainingMs: milliseconds };
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
	if (predecessor === null) {
		return { kind: 'resolved', invocation: { kind: 'cut', viewId: stop.entryViewId } };
	}
	const exit = stopById(program, predecessor)?.entryViewId;
	const fromExit = exit === state.viewId;
	const transition = (options.transitions ?? []).find(
		(entry) => entry.fromStopId === predecessor && entry.toStopId === stopId
	);
	if (transition !== undefined) {
		if (transition.invocation.kind !== 'travel' || fromExit) {
			return { kind: 'resolved', invocation: transition.invocation };
		}
		return { kind: 'gap', message: `Travel from Stop "${predecessor}" starts at its entry View` };
	}
	const index = program.stops.findIndex((entry) => entry.id === stopId);
	const authoredPredecessor = index > 0 ? program.stops[index - 1]!.id : null;
	if (authoredPredecessor === predecessor && fromExit) return { kind: 'resolved', invocation: stop.invocation };
	if (stop.invocation.kind === 'cut') return { kind: 'resolved', invocation: stop.invocation };
	return {
		kind: 'gap',
		message: `arriving at Stop "${stopId}" from "${predecessor}" has no resolved Camera transition; its bound Travel starts from "${authoredPredecessor ?? 'the entry'}"`
	};
}

/**
 * Arrive at a Stop occurrence: a fresh occurrence identity, the Presentation's
 * panel and its invocation intent. A Cut arrives at once and starts the stay;
 * a Travel is `traveling` until the host confirms the arrival.
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
	const presentation = presentationById(program, stop.presentationId);
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
	const outsideSelection = state.pendingContent.filter(
		(contentId) => !presentation.content.some((record) => record.id === contentId)
	);
	const panel: ExperiencePanel = {
		presentationId: presentation.id,
		title: presentation.label,
		content: selected.map((record) => ({ id: record.id, text: record.text }))
	};
	const base: ExperienceRunState = {
		...state,
		stopId,
		occurrenceId: visit.occurrenceId,
		presentationId: presentation.id,
		viewId: stop.entryViewId,
		viewIndex: presentation.viewIds.indexOf(stop.entryViewId),
		visited: appendVisit ? [...state.visited, visit] : state.visited,
		panel,
		pendingContent: [],
		invocation,
		invocationFromViewId: invocation.kind === 'travel' ? state.viewId : null,
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
	const result = invocation.kind === 'travel'
		? { ...actioned.state, phase: 'traveling' as const }
		: beginStay(actioned.state, stop, nextEffects);
	// A lifecycle `continue` resolves the occurrence exactly once, and only when the
	// occurrence is waiting: a stay is time, so it is not skipped by the action.
	if (actioned.continueRequested && result.phase === 'ready') {
		return advance(program, result, options, nextEffects, continueDepth);
	}
	return { state: result, outcome: 'accepted', effects: nextEffects };
}

/**
 * Advance the Guide clock. Ticks are ignored while paused or exploring. A tick
 * during an arrival Travel or a wait only moves the clock; a tick through the
 * end of a stay plays on (Automatic), and the remainder runs into the next stay
 * when that arrival is a Cut.
 */
function tick(
	program: ExecutionProgram,
	state: ExperienceRunState,
	milliseconds: number,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	if (!Number.isInteger(milliseconds) || milliseconds < 0) return ignored(state);
	if (state.paused || state.resume !== null) return ignored(state);
	let next: ExperienceRunState = { ...state, elapsedMs: state.elapsedMs + milliseconds };
	let effects: ExperienceEffect[] = [];
	let remaining = milliseconds;
	for (let guard = 0; guard < 1024; guard += 1) {
		if (next.stopId === null || next.phase !== 'holding' || next.holdRemainingMs === null) break;
		if (next.holdRemainingMs > remaining) {
			next = { ...next, holdRemainingMs: next.holdRemainingMs - remaining };
			break;
		}
		remaining -= next.holdRemainingMs;
		const advanced = advance(program, { ...next, holdRemainingMs: 0 }, options, effects);
		next = advanced.state;
		effects = [...advanced.effects];
		if (advanced.outcome === 'ignored') break;
	}
	return accepted(next, effects);
}

function setPaused(program: ExecutionProgram, state: ExperienceRunState, paused: boolean): ExperienceReduceResult {
	if (paused && (program.pacing !== 'automatic' || state.stopId === null)) return ignored(state);
	if (state.paused === paused) return ignored(state);
	return accepted({ ...state, paused }, []);
}

/**
 * Next. It is always available at a Stop: during an arrival Travel it lands now
 * (a Cut to the entry View) and starts the stay; during a stay it moves on; while
 * waiting it continues; on the last Stop it finishes. In Automatic it also
 * resumes play.
 */
function continueRun(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions
): ExperienceReduceResult {
	if (state.stopId === null) return ignored(state);
	const current = state.paused ? { ...state, paused: false } : state;
	const effects: ExperienceEffect[] = [];
	if (current.phase === 'traveling') {
		const stop = stopById(program, current.stopId!)!;
		const invocation: ProgramInvocation = { kind: 'cut', viewId: stop.entryViewId };
		effects.push({ kind: 'camera', stopId: stop.id, invocation });
		return accepted(
			beginStay({ ...current, invocation, invocationFromViewId: null }, stop, effects),
			effects
		);
	}
	const advanced = advance(program, current, options, effects);
	// A paused run that pressed Next still plays on, even when the advance had
	// nowhere to go.
	return advanced.outcome === 'ignored' && current !== state ? accepted(current, advanced.effects) : advanced;
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
	// the origin occurrence before **any** continuation kind is resolved.
	if (state.returnToStopId !== null) {
		const origin = state.returnToStopId;
		const returned = arrive(program, state, origin, options, effects, true, 0, continueDepth + 1);
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

/**
 * Back to the tour: restore the suspended occurrence as a Cut to its View. It is
 * the same occurrence — no new visit, and arrival lifecycle actions do not run
 * again — with the same play, pause or wait state. When under the lead-in of
 * the stay remained, the playhead steps back to leave the lead-in (never longer
 * than the stay itself); the Guide gets no longer.
 */
function resumeGuide(program: ExecutionProgram, state: ExperienceRunState): ExperienceReduceResult {
	const suspended = state.resume;
	if (suspended === null) return ignored(state);
	const stop = stopById(program, suspended.stopId);
	const presentation = stop === undefined ? undefined : presentationById(program, stop.presentationId);
	if (stop === undefined || presentation === undefined) return ignored(state);
	const stay = stayMs(stop);
	const holdRemainingMs = suspended.holdRemainingMs === null || stay === null
		? null
		: Math.max(suspended.holdRemainingMs, Math.min(EXPERIENCE_RESUME_LEAD_IN_MS, stay));
	const invocation: ProgramInvocation = { kind: 'cut', viewId: suspended.viewId };
	const panel = fullPanel(presentation);
	const next: ExperienceRunState = {
		...state,
		resume: null,
		stopId: suspended.stopId,
		occurrenceId: suspended.occurrenceId,
		presentationId: presentation.id,
		viewId: suspended.viewId,
		viewIndex: presentation.viewIds.indexOf(suspended.viewId),
		phase: holdRemainingMs === null ? 'ready' : 'holding',
		holdRemainingMs,
		paused: suspended.paused,
		panel,
		pendingContent: [],
		invocation,
		invocationFromViewId: null,
		returnToStopId: suspended.returnToStopId,
		lastEvent: 'arrival'
	};
	return accepted(next, [
		{ kind: 'camera', stopId: stop.id, invocation },
		{ kind: 'panel', panel },
		holdRemainingMs === null
			? { kind: 'ready', stopId: stop.id }
			: { kind: 'hold', stopId: stop.id, milliseconds: holdRemainingMs }
	]);
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
		return arrive(program, { ...state, resume: null }, stopId, options, []);
	}
	const detour = (options.detours ?? []).find(
		(entry) => entry.fromStopId === state.stopId && entry.toStopId === stopId
	);
	const next: ExperienceRunState = detour === undefined
		? { ...state, returnToStopId: null, resume: null }
		: { ...state, returnToStopId: detour.returnToStopId, resume: null };
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
		viewId: null,
		viewIndex: null,
		phase: 'ready',
		elapsedMs: 0,
		holdRemainingMs: null,
		paused: false,
		visited: [],
		values,
		panel: null,
		pendingContent: [],
		invocation: null,
		invocationFromViewId: null,
		returnToStopId: null,
		resume: null,
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
	// Defence in depth for any internal caller: an ended run never runs another
	// lifecycle list. The dispatcher already rejects terminal runs.
	if (state.phase === 'completed' || state.phase === 'cancelled') return ignored(state);
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
			resume: null,
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
