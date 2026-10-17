/**
 * AM-6 Experience runtime conformance (T3.P01.S06): lowering, the one
 * deterministic interpreter and the semantic companion.
 *
 * The cases are behavioral traces, not implementation snapshots: a repeated Stop
 * gets a fresh occurrence, a hold needs the explicit clock, a gate needs
 * Continue, continuation resolves by occurrence, a stale event cannot advance a
 * newer run, and every admitted destination is reachable from the companion.
 */
import { describe, expect, it } from 'vitest';

import { validateExecutionProgram, type ExecutionProgram } from '@portfolio/project-model/program';
import {
	buildExperienceCompanion,
	createExperienceInterpreter,
	createExperienceRun,
	deriveExperienceRuntimePolicy,
	lowerExperienceProgram,
	replayExperience,
	reduceExperience,
	type ExperienceEvent,
	type ExperienceInterpreterOptions
} from '@portfolio/project-model/units';
import { EXPERIENCE, experienceEnvelope, LOWERING_OPTIONS } from './fixtures';

const OPTIONS = { runId: 'run-1', runEpoch: 1 } as const;

function event<K extends ExperienceEvent['kind']>(
	kind: K,
	extra: Record<string, unknown> = {},
	options: ExperienceInterpreterOptions = OPTIONS
): ExperienceEvent {
	return { kind, runId: options.runId, runEpoch: options.runEpoch, ...extra } as ExperienceEvent;
}

async function program(): Promise<ExecutionProgram> {
	const envelope = await experienceEnvelope();
	const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
	expect(lowered.kind).toBe('lowered');
	if (lowered.kind !== 'lowered') throw new Error(lowered.message);
	return lowered.program;
}

describe('Experience lowering', () => {
	it('derives the entry guide order, the explicit travel binding and the panel content', async () => {
		const lowered = await program();
		expect(validateExecutionProgram(lowered).success).toBe(true);
		expect(lowered.entryStopId).toBe('stop-1');
		expect(lowered.stops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
		expect(lowered.stops[0]).toMatchObject({
			invocation: { kind: 'cut', viewId: 'view-1' },
			holdSeconds: 0.5,
			continuation: { kind: 'sequence-next' }
		});
		expect(lowered.stops[1]).toMatchObject({
			invocation: { kind: 'travel', connectionId: 'connection-1' },
			continuation: { kind: 'end' }
		});
		expect(lowered.localTime).toEqual([{ stopId: 'stop-1', holdSeconds: 0.5 }]);
		expect(lowered.presentations.find((entry) => entry.id === 'presentation-1')?.content).toEqual([
			{ id: 'content-1', kind: 'text', text: 'The piano.' }
		]);
		expect(lowered.presentations.find((entry) => entry.id === 'presentation-2')?.content).toEqual([]);
		expect(lowered.profile).toEqual({ reducedMotion: 'required', semanticDomNavigation: 'required' });
	});

	it('refuses a non-entry occurrence without an invocation binding instead of inferring a Cut', async () => {
		const envelope = await experienceEnvelope();
		const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, bindings: [] });
		expect(lowered).toMatchObject({ kind: 'refused', code: 'missing-binding', stopId: 'stop-2' });
	});

	it('reports a travel gap when no Camera connection joins the adjacent views', async () => {
		const envelope = await experienceEnvelope();
		const lowered = lowerExperienceProgram(envelope, {
			...LOWERING_OPTIONS,
			bindings: [{ stopId: 'stop-2', invocation: { kind: 'travel', connectionId: 'connection-absent' } }]
		});
		expect(lowered).toMatchObject({ kind: 'refused', code: 'travel-gap', stopId: 'stop-2' });
	});

	it('refuses an unresolved Presentation View', async () => {
		const envelope = await experienceEnvelope();
		const broken = {
			...envelope,
			units: {
				...envelope.units,
				experience: {
					...envelope.units.experience,
					data: {
						formatVersion: 1 as const,
						experiences: envelope.units.experience.data.experiences.map((experience) => ({
							...experience,
							presentations: experience.presentations.map((presentation) =>
								presentation.id === 'presentation-2' ? { ...presentation, viewId: 'view-absent' } : presentation
							)
						}))
					}
				}
			}
		};
		const lowered = lowerExperienceProgram(broken, LOWERING_OPTIONS);
		expect(lowered).toMatchObject({ kind: 'refused', code: 'unknown-view' });
	});

	it('refuses an explicit order no authored Guide carries', async () => {
		const envelope = await experienceEnvelope();
		// Reordered, shortened, extended and cross-guide sequences are all the same
		// failure: Experience order is authored by a Guide, not supplied by a caller.
		for (const order of [['stop-2', 'stop-1'], ['stop-1'], ['stop-1', 'stop-2', 'stop-3']]) {
			expect(lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, order })).toMatchObject({
				kind: 'refused',
				code: 'invalid-order'
			});
		}
	});

	it('accepts an explicit order only when it is exactly the authored Guide order', async () => {
		const envelope = await experienceEnvelope();
		const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, order: ['stop-1', 'stop-2'] });
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		expect(lowered.program.stops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
	});

	it('refuses a selected Guide the Experience does not carry', async () => {
		const envelope = await experienceEnvelope();
		expect(lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, guideId: 'guide-absent' })).toMatchObject({
			kind: 'refused',
			code: 'unknown-guide'
		});
	});
});

describe('Experience interpreter — occurrence, holds and continuation', () => {
	it('holds for the explicit clock, then continues over the bound Travel', async () => {
		const lowered = await program();
		const interpreter = createExperienceInterpreter(lowered, OPTIONS);
		const entered = interpreter.enter();
		expect(entered.state).toMatchObject({ stopId: 'stop-1', phase: 'holding', holdRemainingMs: 500 });
		expect(entered.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-1',
			invocation: { kind: 'cut', viewId: 'view-1' }
		});

		expect(interpreter.tick(499).state).toMatchObject({ phase: 'holding', holdRemainingMs: 1 });
		expect(interpreter.tick(1).state).toMatchObject({ phase: 'ready', holdRemainingMs: 0 });

		const advanced = interpreter.continue();
		expect(advanced.state).toMatchObject({ stopId: 'stop-2', phase: 'ready' });
		expect(advanced.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-2',
			invocation: { kind: 'travel', connectionId: 'connection-1' }
		});

		const completed = interpreter.continue();
		expect(completed.state.phase).toBe('completed');
		expect(completed.effects).toContainEqual({ kind: 'completed' });
	});

	it('ignores Continue while a hold is still running', async () => {
		const lowered = await program();
		const state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter'));
		const held = reduceExperience(lowered, state.state, event('continue'));
		expect(held).toMatchObject({ outcome: 'ignored', state: { phase: 'holding', stopId: 'stop-1' } });
	});

	it('gives a repeated Stop a fresh occurrence identity', async () => {
		const lowered = await program();
		let state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(lowered, state, event('continue')).state;
		expect(state.visited.map((visit) => visit.occurrenceId)).toEqual(['run-1:stop-1:1', 'run-1:stop-2:2']);
		const back = reduceExperience(lowered, state, event('navigate', { stopId: 'stop-1' }));
		expect(back.state.occurrenceId).toBe('run-1:stop-1:3');
		expect(back.state.visited.map((visit) => visit.stopId)).toEqual(['stop-1', 'stop-2', 'stop-1']);
	});

	it('returns from a covered detour to its origin occurrence', async () => {
		const lowered = await program();
		const options: ExperienceInterpreterOptions = {
			...OPTIONS,
			detours: [{ fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' }]
		};
		let state = reduceExperience(lowered, createExperienceRun(lowered, options), event('enter', {}, options), options).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 }, options), options).state;
		state = reduceExperience(lowered, state, event('navigate', { stopId: 'stop-2' }, options), options).state;
		const returned = reduceExperience(lowered, state, event('continue', {}, options), options);
		// Returning re-enters the origin occurrence as a fresh invocation, including
		// its authored finite hold; only the return obligation is discharged.
		expect(returned.state).toMatchObject({ stopId: 'stop-1', phase: 'holding', holdRemainingMs: 500 });
		expect(returned.state.returnToStopId).toBeNull();
	});

	it('requires Continue at an authored Gate after the hold', async () => {
		const lowered = await program();
		const options: ExperienceInterpreterOptions = { ...OPTIONS, gates: ['presentation-1'] };
		let state = reduceExperience(lowered, createExperienceRun(lowered, options), event('enter', {}, options), options).state;
		expect(state.phase).toBe('holding');
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 }, options), options).state;
		expect(state).toMatchObject({ phase: 'blocked', gated: true });
		const advanced = reduceExperience(lowered, state, event('continue', {}, options), options);
		expect(advanced.state.stopId).toBe('stop-2');
	});

	it('rejects an event from an older run and leaves the newer run untouched', async () => {
		const lowered = await program();
		const newer: ExperienceInterpreterOptions = { runId: 'run-2', runEpoch: 2 };
		const state = reduceExperience(lowered, createExperienceRun(lowered, newer), event('enter', {}, newer), newer).state;
		const stale = reduceExperience(lowered, state, { kind: 'cancel', runId: 'run-1', runEpoch: 1 }, newer);
		expect(stale.outcome).toBe('stale');
		expect(stale.state).toEqual(state);
	});

	it('initializes state once and resets it explicitly', async () => {
		const lowered = await program();
		const withState: ExecutionProgram = {
			...lowered,
			state: [{ id: 'seen', type: 'boolean', values: [], initial: false, reset: true }]
		};
		const options: ExperienceInterpreterOptions = { ...OPTIONS };
		let state = reduceExperience(withState, createExperienceRun(withState, options), event('enter', {}, options), options).state;
		expect(state.values.seen).toBe(false);
		state = reduceExperience(withState, state, event('set-state', { stateId: 'seen', value: true }, options), options).state;
		expect(state.values.seen).toBe(true);
		state = reduceExperience(withState, state, event('reset', {}, options), options).state;
		expect(state.values.seen).toBe(true); // reset value
		expect(state.visited).toHaveLength(1); // re-entered once
	});

	it('replays the same event list to the same state', async () => {
		const lowered = await program();
		const events: ExperienceEvent[] = [
			event('enter'),
			event('tick', { milliseconds: 250 }),
			event('tick', { milliseconds: 250 }),
			event('continue'),
			event('continue')
		];
		const first = replayExperience(lowered, OPTIONS, events);
		const second = replayExperience(lowered, OPTIONS, events);
		expect(first.state).toEqual(second.state);
		expect(first.state.phase).toBe('completed');
	});

	/**
	 * Reach a detour from `stop-3` back to `stop-1`. The detour target is a
	 * different occurrence from the origin, so a return that is skipped is visible
	 * as the wrong Stop and an undisclosed continuation.
	 */
	async function detourToOrigin(continuation?: ExecutionProgram['stops'][number]['continuation']) {
		const base = await program();
		const third = { ...base.stops[0]!, id: 'stop-3', holdSeconds: 0 };
		const stops = [
			...base.stops.map((stop) => (stop.id === 'stop-1' && continuation ? { ...stop, continuation } : stop)),
			third
		];
		const extended: ExecutionProgram = { ...base, stops };
		const options: ExperienceInterpreterOptions = {
			...OPTIONS,
			detours: [{ fromStopId: 'stop-3', toStopId: 'stop-1', returnToStopId: 'stop-3' }]
		};
		let state = reduceExperience(extended, createExperienceRun(extended, options), event('enter', {}, options), options).state;
		state = reduceExperience(extended, state, event('tick', { milliseconds: 500 }, options), options).state;
		state = reduceExperience(extended, state, event('continue', {}, options), options).state;
		state = reduceExperience(extended, state, event('navigate', { stopId: 'stop-3' }, options), options).state;
		state = reduceExperience(extended, state, event('navigate', { stopId: 'stop-1' }, options), options).state;
		expect(state).toMatchObject({ stopId: 'stop-1', returnToStopId: 'stop-3' });
		state = reduceExperience(extended, state, event('tick', { milliseconds: 500 }, options), options).state;
		return reduceExperience(extended, state, event('continue', {}, options), options);
	}

	it('returns to the detour origin when the detour target continues sequence-next', async () => {
		const returned = await detourToOrigin();
		expect(returned.state).toMatchObject({ stopId: 'stop-3', returnToStopId: null });
		expect(returned.state.occurrenceId).toBe('run-1:stop-3:5');
	});

	it('returns to the detour origin when the detour target declares an explicit Stop', async () => {
		const returned = await detourToOrigin({ kind: 'stop', stopId: 'stop-2' });
		// The explicit Stop is the detour target's own continuation; the excursion
		// still unwinds to the origin instead of following it.
		expect(returned.state).toMatchObject({ stopId: 'stop-3', returnToStopId: null });
	});

	it('resolves an explicit nonadjacent Stop continuation', async () => {
		const base = await program();
		const third = { ...base.stops[0]!, id: 'stop-3', holdSeconds: 0, continuation: { kind: 'end' as const } };
		const program3: ExecutionProgram = {
			...base,
			stops: [{ ...base.stops[0]!, continuation: { kind: 'stop', stopId: 'stop-3' } }, base.stops[1]!, third]
		};
		let state = reduceExperience(program3, createExperienceRun(program3, OPTIONS), event('enter')).state;
		state = reduceExperience(program3, state, event('tick', { milliseconds: 500 })).state;
		const jumped = reduceExperience(program3, state, event('continue'));
		expect(jumped.state.stopId).toBe('stop-3');
		expect(jumped.state.visited.map((visit) => visit.stopId)).toEqual(['stop-1', 'stop-3']);
	});

	it('applies an enter show-content selection to the first arrival panel', async () => {
		const base = await program();
		const narrowed: ExecutionProgram = {
			...base,
			presentations: base.presentations.map((presentation) =>
				presentation.id === 'presentation-1'
					? { ...presentation, content: [...presentation.content, { id: 'content-2', kind: 'text' as const, text: 'The bench.' }] }
					: presentation
			),
			lifecycle: [{ event: 'enter', guard: null, action: { kind: 'show-content', contentId: 'content-2' } }]
		};
		const state = reduceExperience(narrowed, createExperienceRun(narrowed, OPTIONS), event('enter')).state;
		expect(state.panel?.content).toEqual([{ id: 'content-2', text: 'The bench.' }]);
		expect(state.pendingContent).toEqual([]);
	});

	it('resolves a lifecycle continue after arrival, but never through a hold or Gate', async () => {
		const base = await program();
		const auto: ExecutionProgram = {
			...base,
			lifecycle: [{ event: 'arrival', guard: null, action: { kind: 'continue' } }]
		};
		// The entry occurrence holds, so its arrival cannot be continued by the action.
		const held = reduceExperience(auto, createExperienceRun(auto, OPTIONS), event('enter'));
		expect(held.state).toMatchObject({ stopId: 'stop-1', phase: 'holding' });
		// A ready occurrence continues once, and the action is not replayed later.
		const advanced = reduceExperience(auto, held.state, event('navigate', { stopId: 'stop-2' }));
		expect(advanced.state.phase).toBe('completed');
		expect(advanced.effects.filter((effect) => effect.kind === 'completed')).toHaveLength(1);
	});

	it('evaluates guards and applies open-url only when the guard passes', async () => {
		const base = await program();
		const guarded: ExecutionProgram = {
			...base,
			state: [{ id: 'seen', type: 'boolean', values: [], initial: false, reset: false }],
			lifecycle: [
				{ event: 'arrival', guard: { kind: 'state', stateId: 'seen' }, action: { kind: 'open-url', url: 'https://example.test/tour' } }
			]
		};
		let state = reduceExperience(guarded, createExperienceRun(guarded, OPTIONS), event('enter')).state;
		expect(state.values.seen).toBe(false);
		state = reduceExperience(guarded, state, event('set-state', { stateId: 'seen', value: true })).state;
		const opened = reduceExperience(guarded, state, event('navigate', { stopId: 'stop-2' }));
		expect(opened.effects).toContainEqual({ kind: 'open-url', url: 'https://example.test/tour' });
	});

	it('does not follow a navigate-to declared on completion', async () => {
		const base = await program();
		const ending: ExecutionProgram = {
			...base,
			lifecycle: [{ event: 'complete', guard: null, action: { kind: 'navigate-to', stopId: 'stop-1' } }]
		};
		let state = reduceExperience(ending, createExperienceRun(ending, OPTIONS), event('enter')).state;
		state = reduceExperience(ending, state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(ending, state, event('continue')).state;
		const completed = reduceExperience(ending, state, event('continue'));
		expect(completed.state.phase).toBe('completed');
		expect(completed.state.stopId).toBe('stop-2');
		expect(completed.state.visited).toHaveLength(2);
	});

	it('treats an event from a different lowering source as stale', async () => {
		const lowered = await program();
		const sourceA: ExperienceInterpreterOptions = { ...OPTIONS, sourceContentId: 'source-a' };
		const state = reduceExperience(lowered, createExperienceRun(lowered, sourceA), event('enter', {}, sourceA), sourceA).state;
		const rebased = reduceExperience(lowered, state, event('continue', {}, sourceA), { ...sourceA, sourceContentId: 'source-b' });
		expect(rebased.outcome).toBe('stale');
		expect(rebased.state).toEqual(state);
	});
});

describe('Experience runtime policy', () => {
	it('derives gates and detours from the authored Experience, not from the caller', async () => {
		const authored = {
			...EXPERIENCE,
			experiences: [
				{
					...EXPERIENCE.experiences[0]!,
					gates: [{ id: 'gate-1', presentationId: 'presentation-1' }],
					detours: [{ id: 'detour-1', fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' }]
				}
			]
		};
		const envelope = await experienceEnvelope({ experience: authored });
		expect(deriveExperienceRuntimePolicy(envelope, 'experience-1')).toEqual({
			kind: 'derived',
			policy: {
				gates: ['presentation-1'],
				detours: [{ fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' }]
			}
		});
	});

	it('refuses a gate or detour that names a subject the Experience does not carry', async () => {
		const dangling = {
			...EXPERIENCE,
			experiences: [
				{
					...EXPERIENCE.experiences[0]!,
					gates: [{ id: 'gate-1', presentationId: 'presentation-absent' }]
				}
			]
		};
		const envelope = await experienceEnvelope({ experience: dangling });
		expect(deriveExperienceRuntimePolicy(envelope, 'experience-1').kind).toBe('refused');
	});
});

describe('Experience companion', () => {
	it('makes every admitted destination reachable with occurrence-derived progress', async () => {
		const lowered = await program();
		const state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		const companion = buildExperienceCompanion(lowered, state);
		expect(companion.destinations.map((destination) => destination.stopId)).toEqual(['stop-1', 'stop-2']);
		expect(companion.destinations.every((destination) => destination.reachable)).toBe(true);
		expect(companion.current).toMatchObject({ stopId: 'stop-1', ariaCurrent: 'step' });
		expect(companion.progress).toMatchObject({ visited: 1, total: 2, index: 0 });
		expect(companion.progress.occurrences).toEqual(['run-1:stop-1:1']);
		expect(companion.panel).toMatchObject({ focusOnOpen: 'content', escapeReturnsTo: 'canvas' });
		expect(companion.instructions.activate).toBe('Open this Stop');
	});

	it('explains a required destination a gap makes unreachable', async () => {
		const lowered = await program();
		const state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		const companion = buildExperienceCompanion(lowered, state, new Map([['stop-2', 'the Gallery has no supported Camera route']]));
		expect(companion.destinations.find((destination) => destination.stopId === 'stop-2')).toMatchObject({
			reachable: false,
			gap: 'the Gallery has no supported Camera route'
		});
		expect(companion.gaps).toEqual([{ stopId: 'stop-2', message: 'the Gallery has no supported Camera route' }]);
	});

	it('offers an explicit Continue control at a Gate and explains a running hold', async () => {
		const lowered = await program();
		const options: ExperienceInterpreterOptions = { ...OPTIONS, gates: ['presentation-1'] };
		let state = reduceExperience(lowered, createExperienceRun(lowered, options), event('enter', {}, options), options).state;
		let companion = buildExperienceCompanion(lowered, state);
		expect(companion.continueControl).toMatchObject({
			available: false,
			label: 'Continue',
			reason: 'This Stop is still holding.',
			stopId: 'stop-1',
			occurrenceId: 'run-1:stop-1:1'
		});
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 }, options), options).state;
		companion = buildExperienceCompanion(lowered, state);
		expect(companion.continueControl).toEqual({
			available: true,
			label: 'Continue',
			reason: null,
			stopId: 'stop-1',
			occurrenceId: 'run-1:stop-1:1'
		});
	});

	it('clears the current destination and bounded progress when the run ends', async () => {
		const lowered = await program();
		let state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(lowered, state, event('continue')).state;
		state = reduceExperience(lowered, state, event('continue')).state;
		const companion = buildExperienceCompanion(lowered, state);
		expect(state.phase).toBe('completed');
		expect(companion.current).toBeNull();
		expect(companion.continueControl).toBeNull();
		expect(companion.progress).toMatchObject({ visited: 2, total: 2, index: null });
	});

	it('counts distinct Stops so a revisit cannot exceed the run size', async () => {
		const lowered = await program();
		let state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(lowered, state, event('continue')).state;
		state = reduceExperience(lowered, state, event('navigate', { stopId: 'stop-1' })).state;
		expect(state.visited).toHaveLength(3);
		const companion = buildExperienceCompanion(lowered, state);
		expect(companion.progress.visited).toBe(2);
		expect(companion.progress.total).toBe(2);
	});
});
