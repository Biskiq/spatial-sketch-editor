import type {
	ExecutionProgram,
	ProgramInvocation,
	ProgramPresentation,
	ProgramStop,
} from '../../../program/types';
import type {
	ExperienceEffect,
	ExperienceEvent,
	ExperienceInterpreterOptions,
	ExperiencePanel,
	ExperienceReduceResult,
	ExperienceRunPhase,
	ExperienceRunState,
	ExperienceVisit,
} from './contracts';
import { EXPERIENCE_RESUME_LEAD_IN_MS } from './contracts';
import { accepted, applyLifecycle, ignored } from './lifecycle';
import { createExperienceRun, reduceExperience } from './reduce';

/** A small imperative wrapper over the pure reducer. */
export function createExperienceInterpreter(
	program: ExecutionProgram,
	options: ExperienceInterpreterOptions,
) {
	let current = createExperienceRun(program, options);
	const run = <K extends ExperienceEvent['kind']>(kind: K) =>
		({ kind, runId: current.runId, runEpoch: current.runEpoch }) as Extract<
			ExperienceEvent,
			{ kind: K }
		>;
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
				...(viewId === undefined ? {} : { viewId }),
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
		},
	};
}

export function sameRun(state: ExperienceRunState, event: ExperienceEvent): boolean {
	return state.runId === event.runId && state.runEpoch === event.runEpoch;
}

function stopById(program: ExecutionProgram, stopId: string): ProgramStop | undefined {
	return program.stops.find((stop) => stop.id === stopId);
}

function presentationById(
	program: ExecutionProgram,
	presentationId: string | null,
): ProgramPresentation | undefined {
	return presentationId === null
		? undefined
		: program.presentations.find((entry) => entry.id === presentationId);
}

function fullPanel(presentation: ProgramPresentation): ExperiencePanel {
	return {
		presentationId: presentation.id,
		title: presentation.label,
		content: presentation.content.map((record) => ({ id: record.id, text: record.text })),
	};
}

function stayMs(stop: ProgramStop): number | null {
	return stop.staySeconds === null ? null : Math.round(stop.staySeconds * 1000);
}

export function enter(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions,
): ExperienceReduceResult {
	if (state.entered) return accepted(state, []);
	if (program.entryStopId === null) {
		return {
			state: { ...state, entered: true, resume: null, phase: 'completed', lastEvent: 'enter' },
			outcome: 'accepted',
			effects: [{ kind: 'completed' }],
		};
	}
	const entered: ExperienceRunState = {
		...state,
		entered: true,
		resume: null,
		paused: false,
		lastEvent: 'enter',
	};
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
export function enterPresentation(
	program: ExecutionProgram,
	state: ExperienceRunState,
	presentationId: string,
	viewId: string | undefined,
): ExperienceReduceResult {
	const presentation = presentationById(program, presentationId);
	if (presentation === undefined) return ignored(state);
	const startViewId =
		viewId !== undefined && presentation.viewIds.includes(viewId)
			? viewId
			: presentation.viewIds[0]!;
	let resume = state.resume;
	if (state.stopId !== null && state.occurrenceId !== null) {
		const stop = stopById(program, state.stopId)!;
		const landed = state.phase === 'traveling';
		resume = {
			stopId: state.stopId,
			occurrenceId: state.occurrenceId,
			viewId: landed ? stop.entryViewId : (state.viewId ?? stop.entryViewId),
			holdRemainingMs: landed
				? stayMs(stop)
				: state.phase === 'holding'
					? state.holdRemainingMs
					: null,
			paused: state.paused,
			returnToStopId: state.returnToStopId,
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
		lastEvent: 'arrival',
	};
	return accepted(next, [
		{ kind: 'camera', stopId: null, invocation },
		{ kind: 'panel', panel },
		{ kind: 'ready', stopId: null },
	]);
}

/**
 * Step to one View of the explored Presentation. A neighbour plays the
 * Presentation's authored step (a Travel runs its path in either direction);
 * any other pick is a Cut, because Experience never routes through the Camera
 * graph. Steps add no Guide time.
 */
export function exploreView(
	program: ExecutionProgram,
	state: ExperienceRunState,
	viewId: string,
): ExperienceReduceResult {
	if (state.stopId !== null) return ignored(state);
	const presentation = presentationById(program, state.presentationId);
	if (presentation === undefined || state.viewId === null) return ignored(state);
	const to = presentation.viewIds.indexOf(viewId);
	const from = presentation.viewIds.indexOf(state.viewId);
	if (to === -1 || to === from) return ignored(state);
	const step =
		from === -1
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
			invocationFromViewId: invocation.kind === 'travel' ? state.viewId : null,
		},
		[{ kind: 'camera', stopId: null, invocation }],
	);
}

export function arrivalEvent(
	program: ExecutionProgram,
	state: ExperienceRunState,
): ExperienceReduceResult {
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
function beginStay(
	state: ExperienceRunState,
	stop: ProgramStop,
	effects: ExperienceEffect[],
): ExperienceRunState {
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
	options: ExperienceInterpreterOptions,
):
	| { readonly kind: 'resolved'; readonly invocation: ProgramInvocation }
	| { readonly kind: 'gap'; readonly message: string } {
	const predecessor = state.stopId;
	if (predecessor === null) {
		return { kind: 'resolved', invocation: { kind: 'cut', viewId: stop.entryViewId } };
	}
	const exit = stopById(program, predecessor)?.entryViewId;
	const fromExit = exit === state.viewId;
	const transition = (options.transitions ?? []).find(
		(entry) => entry.fromStopId === predecessor && entry.toStopId === stopId,
	);
	if (transition !== undefined) {
		if (transition.invocation.kind !== 'travel' || fromExit) {
			return { kind: 'resolved', invocation: transition.invocation };
		}
		return { kind: 'gap', message: `Travel from Stop "${predecessor}" starts at its entry View` };
	}
	const index = program.stops.findIndex((entry) => entry.id === stopId);
	const authoredPredecessor = index > 0 ? program.stops[index - 1]!.id : null;
	if (authoredPredecessor === predecessor && fromExit)
		return { kind: 'resolved', invocation: stop.invocation };
	if (stop.invocation.kind === 'cut') return { kind: 'resolved', invocation: stop.invocation };
	return {
		kind: 'gap',
		message: `arriving at Stop "${stopId}" from "${predecessor}" has no resolved Camera transition; its bound Travel starts from "${authoredPredecessor ?? 'the entry'}"`,
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
	continueDepth = 0,
): ExperienceReduceResult {
	if (depth > 8) {
		return {
			state,
			outcome: 'ignored',
			effects: [
				...effects,
				{
					kind: 'gap',
					fromStopId: state.stopId,
					toStopId: stopId,
					message: 'the arrival lifecycle redirects too many times',
				},
			],
		};
	}
	const stop = stopById(program, stopId);
	if (stop === undefined) {
		return {
			state,
			outcome: 'ignored',
			effects: [
				...effects,
				{
					kind: 'gap',
					fromStopId: state.stopId,
					toStopId: stopId,
					message: `the program carries no Stop "${stopId}"`,
				},
			],
		};
	}
	const presentation = presentationById(program, stop.presentationId);
	if (presentation === undefined) {
		return {
			state,
			outcome: 'ignored',
			effects: [
				...effects,
				{
					kind: 'gap',
					fromStopId: state.stopId,
					toStopId: stopId,
					message: `Stop "${stopId}" names no Presentation`,
				},
			],
		};
	}
	// The invocation must be valid for the approach this run actually made. A
	// Travel bound to another predecessor is a typed gap: the run does not arrive
	// and no Camera intent is emitted.
	const resolvedInvocation = invocationFor(program, state, stopId, stop, options);
	if (resolvedInvocation.kind === 'gap') {
		return {
			state,
			outcome: 'ignored',
			effects: [
				...effects,
				{
					kind: 'gap',
					fromStopId: state.stopId,
					toStopId: stopId,
					message: resolvedInvocation.message,
				},
			],
		};
	}
	const invocation = resolvedInvocation.invocation;
	const visit: ExperienceVisit = {
		stopId,
		occurrenceId: `${state.runId}:${stopId}:${state.visited.length + 1}`,
		index: state.visited.length + 1,
	};
	// A `show-content` selected before this arrival (an `enter` lifecycle action, or
	// an arrival action that ran before the panel existed) narrows the panel to the
	// selected records. The selection is consumed once, here, so a later Stop shows
	// its own full Presentation.
	const matchedSelection =
		state.pendingContent.length === 0
			? presentation.content
			: presentation.content.filter((record) => state.pendingContent.includes(record.id));
	// A selection that names only another Presentation's content must not blank the
	// panel: the arrival shows its own full Presentation and reports the foreign id
	// as a gap below. A partially matching selection still narrows as declared.
	const selected = matchedSelection.length === 0 ? presentation.content : matchedSelection;
	const outsideSelection = state.pendingContent.filter(
		(contentId) => !presentation.content.some((record) => record.id === contentId),
	);
	const panel: ExperiencePanel = {
		presentationId: presentation.id,
		title: presentation.label,
		content: selected.map((record) => ({ id: record.id, text: record.text })),
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
		lastEvent: 'arrival',
	};
	const nextEffects: ExperienceEffect[] = [
		...effects,
		{ kind: 'camera', stopId, invocation },
		{ kind: 'panel', panel },
	];
	for (const contentId of outsideSelection) {
		nextEffects.push({
			kind: 'gap',
			fromStopId: state.stopId,
			toStopId: stopId,
			message: `show-content selected "${contentId}", which Presentation "${presentation.id}" does not carry`,
		});
	}
	const actioned = applyLifecycle(program, base, 'arrival', nextEffects);
	if (actioned.navigateTo !== null && actioned.navigateTo !== stopId) {
		return arrive(
			program,
			actioned.state,
			actioned.navigateTo,
			options,
			nextEffects,
			true,
			depth + 1,
		);
	}
	const result =
		invocation.kind === 'travel'
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
export function tick(
	program: ExecutionProgram,
	state: ExperienceRunState,
	milliseconds: number,
	options: ExperienceInterpreterOptions,
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

export function setPaused(
	program: ExecutionProgram,
	state: ExperienceRunState,
	paused: boolean,
): ExperienceReduceResult {
	if (
		paused &&
		((program.pacing !== 'automatic' && state.phase !== 'traveling') || state.stopId === null)
	)
		return ignored(state);
	if (state.paused === paused) return ignored(state);
	return accepted({ ...state, paused }, []);
}

/**
 * Next. It is always available at a Stop: during an arrival Travel it lands now
 * (a Cut to the entry View) and starts the stay; during a stay it moves on; while
 * waiting it continues; on the last Stop it finishes. In Automatic it also
 * resumes play.
 */
export function continueRun(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions,
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
			effects,
		);
	}
	const advanced = advance(program, current, options, effects);
	// A paused run that pressed Next still plays on, even when the advance had
	// nowhere to go.
	return advanced.outcome === 'ignored' && current !== state
		? accepted(current, advanced.effects)
		: advanced;
}

/** Resolve the occurrence's continuation once, by occurrence identity. */
function advance(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions,
	effects: ExperienceEffect[],
	continueDepth = 0,
): ExperienceReduceResult {
	if (state.stopId === null) return ignored(state);
	if (continueDepth > 8) {
		return {
			state,
			outcome: 'ignored',
			effects: [
				...effects,
				{
					kind: 'gap',
					fromStopId: state.stopId,
					toStopId: state.stopId,
					message: 'the arrival lifecycle continues too many times',
				},
			],
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
		return arrive(
			program,
			{ ...state, returnToStopId: null },
			continuation.stopId,
			options,
			effects,
			true,
			0,
			continueDepth + 1,
		);
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
export function resumeGuide(
	program: ExecutionProgram,
	state: ExperienceRunState,
): ExperienceReduceResult {
	const suspended = state.resume;
	if (suspended === null) return ignored(state);
	const stop = stopById(program, suspended.stopId);
	const presentation =
		stop === undefined ? undefined : presentationById(program, stop.presentationId);
	if (stop === undefined || presentation === undefined) return ignored(state);
	const stay = stayMs(stop);
	const holdRemainingMs =
		suspended.holdRemainingMs === null || stay === null
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
		lastEvent: 'arrival',
	};
	return accepted(next, [
		{ kind: 'camera', stopId: stop.id, invocation },
		{ kind: 'panel', panel },
		holdRemainingMs === null
			? { kind: 'ready', stopId: stop.id }
			: { kind: 'hold', stopId: stop.id, milliseconds: holdRemainingMs },
	]);
}

export function navigate(
	program: ExecutionProgram,
	state: ExperienceRunState,
	stopId: string,
	options: ExperienceInterpreterOptions,
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
		(entry) => entry.fromStopId === state.stopId && entry.toStopId === stopId,
	);
	const next: ExperienceRunState =
		detour === undefined
			? { ...state, returnToStopId: null, resume: null }
			: { ...state, returnToStopId: detour.returnToStopId, resume: null };
	return arrive(program, next, stopId, options, []);
}

export function setState(
	program: ExecutionProgram,
	state: ExperienceRunState,
	stateId: string,
	value: string | boolean,
): ExperienceReduceResult {
	const declaration = program.state.find((entry) => entry.id === stateId);
	if (declaration === undefined) return ignored(state);
	const valid =
		declaration.type === 'boolean'
			? typeof value === 'boolean'
			: typeof value === 'string' && declaration.values.includes(value);
	if (!valid) return ignored(state);
	return {
		state: { ...state, values: { ...state.values, [stateId]: value } },
		outcome: 'accepted',
		effects: [],
	};
}

export function resetRun(
	program: ExecutionProgram,
	state: ExperienceRunState,
	options: ExperienceInterpreterOptions,
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
		lastEvent: null,
	};
	return enter(program, reset, options);
}

export function finish(
	program: ExecutionProgram,
	state: ExperienceRunState,
	event: 'complete' | 'cancel',
	_options: ExperienceInterpreterOptions,
	effects: ExperienceEffect[] = [],
): ExperienceReduceResult {
	// Defence in depth for any internal caller: an ended run never runs another
	// lifecycle list. The dispatcher already rejects terminal runs.
	if (state.phase === 'completed' || state.phase === 'cancelled') return ignored(state);
	const actioned = applyLifecycle(program, state, event, effects);
	const phase: ExperienceRunPhase = event === 'complete' ? 'completed' : 'cancelled';
	const values =
		event === 'cancel'
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
			pendingContent: [],
		},
		outcome: 'accepted',
		effects: event === 'complete' ? [...effects, { kind: 'completed' }] : effects,
	};
}
