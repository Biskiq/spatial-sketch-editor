import type { ExecutionProgram } from '../../../program/types';
import type {
	ExperienceEffect,
	ExperienceEvent,
	ExperienceInterpreterOptions,
	ExperienceReduceOutcome,
	ExperienceReduceResult,
	ExperienceRunState,
} from './contracts';
import { ignored } from './lifecycle';
import {
	arrivalEvent,
	continueRun,
	enter,
	enterPresentation,
	exploreView,
	finish,
	navigate,
	resetRun,
	resumeGuide,
	sameRun,
	setPaused,
	setState,
	tick,
} from './session';

/** The state before `enter`: no occurrence, values at their declared initial. */
export function createExperienceRun(
	program: ExecutionProgram,
	options: ExperienceInterpreterOptions,
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
		lastEvent: null,
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
	options: ExperienceInterpreterOptions = { runId: state.runId, runEpoch: state.runEpoch },
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
	events: readonly ExperienceEvent[],
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
