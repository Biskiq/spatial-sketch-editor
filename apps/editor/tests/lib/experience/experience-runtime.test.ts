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
import { CONNECTIONS, EXPERIENCE, experienceEnvelope, LOWERING_OPTIONS, VIEWS } from './fixtures';

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

/**
 * Three Stops where `stop-3` is reached by a Travel from `stop-2`'s view. It makes
 * the difference between "the Guide predecessor" and "the predecessor this run
 * actually came from" observable.
 */
async function threeStopLowering(jumpFromEntry = false) {
	const base = EXPERIENCE.experiences[0]!;
	const thirdView = {
		id: 'view-3',
		label: 'Study',
		eye: [8, 1.6, 2] as [number, number, number],
		target: [8, 1.4, 0] as [number, number, number],
		fov: 54,
		connectedViewIds: ['view-2']
	};
	const secondConnection = {
		...CONNECTIONS[0]!,
		id: 'connection-2',
		fromNodeId: 'view-2',
		toNodeId: 'view-3',
		positionPath: { ...CONNECTIONS[0]!.positionPath, anchors: [{ id: 'anchor-2', position: [6, 1.6, 2] as [number, number, number] }] }
	};
	const envelope = await experienceEnvelope({
		camera: {
			formatVersion: 1,
			views: [
				...VIEWS.map((view) =>
					view.id === 'view-2' ? { ...view, connectedViewIds: ['view-1', 'view-3'] } : view
				),
				thirdView
			],
			connections: [...CONNECTIONS, secondConnection]
		},
		experience: {
			...EXPERIENCE,
			experiences: [
				{
					...base,
					presentations: [...base.presentations, { id: 'presentation-3', label: 'Study', viewId: 'view-3' }],
					stops: [
						jumpFromEntry
							? { ...base.stops[0]!, continuation: { kind: 'stop' as const, stopId: 'stop-3' } }
							: base.stops[0]!,
						base.stops[1]!,
						{ id: 'stop-3', presentationId: 'presentation-3', continuation: { kind: 'end' as const } }
					],
					guides: [{ ...base.guides[0]!, stopIds: ['stop-1', 'stop-2', 'stop-3'] }]
				}
			]
		}
	});
	return lowerExperienceProgram(envelope, {
		...LOWERING_OPTIONS,
		bindings: [
			{ stopId: 'stop-2', invocation: { kind: 'travel' as const, connectionId: 'connection-1' } },
			{ stopId: 'stop-3', invocation: { kind: 'travel' as const, connectionId: 'connection-2' } }
		]
	});
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

	it('keeps a Guide-free Presentation reachable instead of dropping it', async () => {
		const base = EXPERIENCE.experiences[0]!;
		// `presentation-study` has no Stop in this Guide. AM-9 says a Presentation
		// may exist without a Guide; lowering emits it and the companion exposes it
		// as a destination, rather than silently dropping the authored record.
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						presentations: [
							...base.presentations,
							{ id: 'presentation-study', label: 'Study', viewId: 'view-2' }
						]
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		expect(lowered.program.presentations.map((presentation) => presentation.id)).toContain('presentation-study');
		const entered = reduceExperience(lowered.program, createExperienceRun(lowered.program, OPTIONS), event('enter'));
		const companion = buildExperienceCompanion(lowered.program, entered.state);
		expect(companion.presentations).toContainEqual({
			presentationId: 'presentation-study',
			label: 'Study',
			viewId: 'view-2',
			stopIds: []
		});
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

	it('derives a transition for every authored edge from its real Camera route', async () => {
		const lowered = await threeStopLowering();
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		expect(lowered.transitions).toEqual([
			{ fromStopId: 'stop-1', toStopId: 'stop-2', invocation: { kind: 'travel', connectionId: 'connection-1' } },
			{ fromStopId: 'stop-2', toStopId: 'stop-3', invocation: { kind: 'travel', connectionId: 'connection-2' } }
		]);
	});

	it('refuses an authored explicit jump whose Travel starts at a different Stop', async () => {
		// stop-1 authors an explicit continuation to stop-3, but stop-3's Travel is
		// bound from stop-2's view. The edge has no Camera route of its own.
		const lowered = await threeStopLowering(true);
		expect(lowered).toMatchObject({ kind: 'refused', code: 'travel-gap' });
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

	it('refuses an order borrowed from a different Guide than the selected one', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						guides: [...base.guides, { id: 'guide-2', label: 'Reverse', stopIds: ['stop-2', 'stop-1'], entryStopId: 'stop-2' }]
					}
				]
			}
		});
		// guide-2's sequence is authored, but not by the selected guide-1: mixing one
		// Guide's entry with another Guide's order is the same second-authority defect
		// as a hand-written sequence.
		expect(
			lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, guideId: 'guide-1', order: ['stop-2', 'stop-1'] })
		).toMatchObject({ kind: 'refused', code: 'invalid-order' });
		// The same sequence is accepted when it is guide-2's own authored order (the
		// assertion is about the order claim, not about guide-2's binding coverage).
		expect(
			lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, guideId: 'guide-2', order: ['stop-2', 'stop-1'] })
		).not.toMatchObject({ code: 'invalid-order' });
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

	it('treats an arrival confirmation as no second Camera write', async () => {
		const lowered = await program();
		const entered = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter'));
		const arrival = reduceExperience(lowered, entered.state, event('arrival'));
		expect(arrival.outcome).toBe('accepted');
		expect(arrival.effects).toEqual([]);
		expect(arrival.state).toEqual({ ...entered.state, lastEvent: 'arrival' });
	});

	it('ignores an arrival that reaches a completed or cancelled run', async () => {
		const lowered = await program();
		let state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(lowered, state, event('continue')).state;
		const completed = reduceExperience(lowered, state, event('continue')).state;
		expect(completed.phase).toBe('completed');
		const lateArrival = reduceExperience(lowered, completed, event('arrival'));
		expect(lateArrival).toMatchObject({ outcome: 'ignored', effects: [] });
		expect(lateArrival.state).toEqual(completed);

		const cancelled = reduceExperience(lowered, state, event('cancel'));
		expect(cancelled.state.phase).toBe('cancelled');
		const afterCancel = reduceExperience(lowered, cancelled.state, event('arrival'));
		expect(afterCancel).toMatchObject({ outcome: 'ignored', effects: [] });
		expect(afterCancel.state).toEqual(cancelled.state);
	});

	it('does not resurrect, flip or re-effect a terminal run', async () => {
		const lowered = await program();
		const entered = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter'));
		const cancelled = reduceExperience(lowered, entered.state, event('cancel'));
		expect(cancelled.state.phase).toBe('cancelled');

		// cancel → complete and complete → cancel must not flip the terminal phase or
		// run the other lifecycle list.
		const lateComplete = reduceExperience(lowered, cancelled.state, event('complete'));
		expect(lateComplete).toMatchObject({ outcome: 'ignored', effects: [] });
		expect(lateComplete.state).toEqual(cancelled.state);
		const lateCancel = reduceExperience(lowered, cancelled.state, event('cancel'));
		expect(lateCancel.state).toEqual(cancelled.state);

		let state = reduceExperience(lowered, entered.state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(lowered, state, event('continue')).state;
		const completed = reduceExperience(lowered, state, event('continue'));
		expect(completed.state.phase).toBe('completed');
		const duplicate = reduceExperience(lowered, completed.state, event('complete'));
		expect(duplicate).toMatchObject({ outcome: 'ignored', effects: [] });
		expect(duplicate.state).toEqual(completed.state);
		const cancelledLate = reduceExperience(lowered, completed.state, event('cancel'));
		expect(cancelledLate.state).toEqual(completed.state);

		// No state-changing event runs after the end either.
		for (const late of [
			event('tick', { milliseconds: 100 }),
			event('set-state', { stateId: 'seen', value: true }),
			event('navigate', { stopId: 'stop-1' }),
			event('continue'),
			event('enter'),
			event('arrival')
		]) {
			const result = reduceExperience(lowered, completed.state, late);
			expect(result).toMatchObject({ outcome: 'ignored', effects: [] });
			expect(result.state).toEqual(completed.state);
		}

		// Reset remains the one supported rewind: it re-enters the same run.
		const reset = reduceExperience(lowered, completed.state, event('reset'));
		expect(reset.state).toMatchObject({ entered: true, stopId: 'stop-1', phase: 'holding' });
		expect(reset.state.visited).toHaveLength(1);
		const resetCancelled = reduceExperience(lowered, cancelled.state, event('reset'));
		expect(resetCancelled.state).toMatchObject({ entered: true, stopId: 'stop-1', phase: 'holding' });
		expect(resetCancelled.state.visited).toHaveLength(1);
	});

	it('never borrows a Travel bound to a different predecessor', async () => {
		const lowered = await threeStopLowering();
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		const options: ExperienceInterpreterOptions = { ...OPTIONS, transitions: lowered.transitions };
		let state = reduceExperience(lowered.program, createExperienceRun(lowered.program, options), event('enter', {}, options), options).state;
		state = reduceExperience(lowered.program, state, event('tick', { milliseconds: 500 }, options), options).state;
		// stop-3's Travel is bound from stop-2's view; this run is still at stop-1.
		const jumped = reduceExperience(lowered.program, state, event('navigate', { stopId: 'stop-3' }, options), options);
		expect(jumped.outcome).toBe('ignored');
		expect(jumped.state.stopId).toBe('stop-1');
		expect(jumped.effects.some((effect) => effect.kind === 'gap')).toBe(true);
		expect(jumped.effects.some((effect) => effect.kind === 'camera')).toBe(false);
	});

	it('uses the transition for the predecessor the run actually came from', async () => {
		const lowered = await threeStopLowering();
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		const options: ExperienceInterpreterOptions = { ...OPTIONS, transitions: lowered.transitions };
		let state = reduceExperience(lowered.program, createExperienceRun(lowered.program, options), event('enter', {}, options), options).state;
		state = reduceExperience(lowered.program, state, event('tick', { milliseconds: 500 }, options), options).state;
		const toGallery = reduceExperience(lowered.program, state, event('navigate', { stopId: 'stop-2' }, options), options);
		expect(toGallery.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-2',
			invocation: { kind: 'travel', connectionId: 'connection-1' }
		});
		// Navigate rather than continue: stop-2 authors an end, and the point here is
		// that the edge from the actual predecessor (stop-2) is the one resolved.
		const toStudy = reduceExperience(lowered.program, toGallery.state, event('navigate', { stopId: 'stop-3' }, options), options);
		expect(toStudy.state).toMatchObject({ stopId: 'stop-3', phase: 'ready' });
		expect(toStudy.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-3',
			invocation: { kind: 'travel', connectionId: 'connection-2' }
		});
		expect(toStudy.state.visited.map((visit) => visit.stopId)).toEqual(['stop-1', 'stop-2', 'stop-3']);
	});

	it('does not place another Presentation\'s content in the active panel', async () => {
		const envelope = await experienceEnvelope();
		const lowered = lowerExperienceProgram(envelope, {
			...LOWERING_OPTIONS,
			content: [
				...LOWERING_OPTIONS.content,
				{ presentationId: 'presentation-2', records: [{ id: 'content-2', text: 'The gallery.' }] }
			]
		});
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		const selected: ExecutionProgram = {
			...lowered.program,
			lifecycle: [{ event: 'arrival', guard: null, action: { kind: 'show-content', contentId: 'content-2' } }]
		};
		const entered = reduceExperience(selected, createExperienceRun(selected, OPTIONS), event('enter'));
		expect(entered.state.panel).toMatchObject({
			presentationId: 'presentation-1',
			content: [{ id: 'content-1', text: 'The piano.' }]
		});
		expect(entered.state.panel?.content.some((record) => record.id === 'content-2')).toBe(false);
		expect(entered.effects.some((effect) => effect.kind === 'gap' && effect.message.includes('content-2'))).toBe(true);
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
		const staleArrival = reduceExperience(lowered, state, { kind: 'arrival', runId: 'run-1', runEpoch: 1 }, newer);
		expect(staleArrival).toMatchObject({ outcome: 'stale', effects: [] });
		expect(staleArrival.state).toEqual(state);
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
		// Reset rewinds the same run: identity and epoch are the host's run identity,
		// so a pending event for this run is still this run, not a resurrected one.
		expect(state.runId).toBe('run-1');
		expect(state.runEpoch).toBe(1);
		expect(state.occurrenceId).toBe('run-1:stop-1:1');
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

	it('keeps the return obligation when the return edge has no transition', async () => {
		const base = await program();
		// The return origin is Travel-bound, so a return with no edge for the actual
		// predecessor must gap instead of borrowing its authored approach.
		const origin = { ...base.stops[0]!, id: 'stop-3', invocation: { kind: 'travel' as const, connectionId: 'connection-1' } };
		const extended: ExecutionProgram = { ...base, stops: [...base.stops, origin] };
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
		const gapped = reduceExperience(extended, state, event('continue', {}, options), options);
		expect(gapped.state).toMatchObject({ stopId: 'stop-1', returnToStopId: 'stop-3' });
		expect(gapped.effects.some((effect) => effect.kind === 'gap')).toBe(true);
		expect(gapped.effects.some((effect) => effect.kind === 'camera')).toBe(false);
	});

	it('keeps the outer return obligation when a detour starts inside an excursion', async () => {
		const lowered = await program();
		const options: ExperienceInterpreterOptions = {
			...OPTIONS,
			detours: [
				{ fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' },
				{ fromStopId: 'stop-2', toStopId: 'stop-1', returnToStopId: 'stop-2' }
			]
		};
		let state = reduceExperience(lowered, createExperienceRun(lowered, options), event('enter', {}, options), options).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 }, options), options).state;
		state = reduceExperience(lowered, state, event('navigate', { stopId: 'stop-2' }, options), options).state;
		expect(state.returnToStopId).toBe('stop-1');
		// The inner policy would owe stop-2, but the outer excursion is still owed:
		// overwriting it would strand the run at the inner origin.
		const nested = reduceExperience(lowered, state, event('navigate', { stopId: 'stop-1' }, options), options);
		expect(nested.state.stopId).toBe('stop-1');
		expect(nested.state.returnToStopId).toBe('stop-1');
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

	it('reports a selection from another Presentation instead of showing an empty panel', async () => {
		const envelope = await experienceEnvelope();
		const lowered = lowerExperienceProgram(envelope, {
			...LOWERING_OPTIONS,
			content: [
				...LOWERING_OPTIONS.content,
				{ presentationId: 'presentation-2', records: [{ id: 'content-2', text: 'The gallery.' }] }
			]
		});
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		// content-2 belongs to presentation-2; the entry arrival is presentation-1.
		const selected: ExecutionProgram = {
			...lowered.program,
			lifecycle: [{ event: 'enter', guard: null, action: { kind: 'show-content', contentId: 'content-2' } }]
		};
		const entered = reduceExperience(selected, createExperienceRun(selected, OPTIONS), event('enter'));
		expect(entered.state.panel?.content).toEqual([{ id: 'content-1', text: 'The piano.' }]);
		expect(entered.effects.some((effect) => effect.kind === 'gap' && effect.message.includes('content-2'))).toBe(true);
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
		// A Gate is a prompt too: the same arrival action must not skip it once the
		// hold has elapsed, and only an explicit Continue may proceed.
		const gateOptions: ExperienceInterpreterOptions = { ...OPTIONS, gates: ['presentation-1'] };
		const gated = reduceExperience(auto, createExperienceRun(auto, gateOptions), event('enter', {}, gateOptions), gateOptions);
		const blocked = reduceExperience(auto, gated.state, event('tick', { milliseconds: 500 }, gateOptions), gateOptions);
		expect(blocked.state).toMatchObject({ stopId: 'stop-1', phase: 'blocked', gated: true });
		expect(blocked.state.visited).toHaveLength(1);
		expect(blocked.effects).not.toContainEqual({ kind: 'completed' });
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
		// The guard is false, so the guarded action must not fire at all.
		const skipped = reduceExperience(guarded, state, event('navigate', { stopId: 'stop-2' }));
		expect(skipped.effects).not.toContainEqual({ kind: 'open-url', url: 'https://example.test/tour' });
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
