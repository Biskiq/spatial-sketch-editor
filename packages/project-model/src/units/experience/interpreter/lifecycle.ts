import type {
	ExecutionProgram,
	ProgramAction,
	ProgramEvent,
	ProgramGuard,
} from '../../../program/types';
import type {
	ExperienceEffect,
	ExperiencePanel,
	ExperienceReduceResult,
	ExperienceRunState,
} from './contracts';

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
export function applyLifecycle(
	program: ExecutionProgram,
	state: ExperienceRunState,
	event: ProgramEvent,
	effects: ExperienceEffect[],
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
	effects: ExperienceEffect[],
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
					continueRequested: false,
				};
			}
			// An open panel belongs to exactly one Presentation. A content record from
			// another Presentation is a typed gap, never content placed under the wrong
			// label and View.
			const active = program.presentations.find(
				(presentation) => presentation.id === state.presentationId,
			);
			const record = active?.content.find((entry) => entry.id === action.contentId);
			if (record === undefined) {
				const livedElsewhere = program.presentations.some(
					(presentation) =>
						presentation.id !== state.presentationId &&
						presentation.content.some((entry) => entry.id === action.contentId),
				);
				if (livedElsewhere) {
					effects.push({
						kind: 'gap',
						fromStopId: state.stopId,
						toStopId: state.stopId ?? '',
						message: `show-content selected "${action.contentId}", which the active Presentation does not carry`,
					});
				}
				return { state, navigateTo: null, continueRequested: false };
			}
			const panel: ExperiencePanel = {
				...state.panel,
				content: [{ id: record.id, text: record.text }],
			};
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
				continueRequested: false,
			};
	}
}

function evaluateGuard(
	guard: ProgramGuard,
	values: Readonly<Record<string, string | boolean>>,
): boolean {
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

export function accepted(
	state: ExperienceRunState,
	effects: readonly ExperienceEffect[],
): ExperienceReduceResult {
	return { state, outcome: 'accepted', effects };
}

export function ignored(state: ExperienceRunState): ExperienceReduceResult {
	return { state, outcome: 'ignored', effects: [] };
}
