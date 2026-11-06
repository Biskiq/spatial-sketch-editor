/**
 * AM-6 Experience runtime conformance (T3.P01.S06): lowering, the one
 * deterministic interpreter and the semantic companion.
 *
 * The cases are behavioral traces, not implementation snapshots: a repeated Stop
 * gets a fresh occurrence, a stay needs the explicit clock and starts only after
 * its arrival, Next always works, Explore freezes the clock and Back restores the
 * same occurrence, continuation resolves by occurrence, a stale event cannot
 * advance a newer run, and every admitted destination is reachable from the
 * companion (Experience format 4, sheet §31).
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
	validateProjectEnvelope,
	type ExperienceEvent,
	type ExperienceInterpreterOptions
} from '@portfolio/project-model/units';
import { CAMERA_UNIT_FORMAT_VERSION } from '@portfolio/project-model/units';
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
					presentations: [
						...base.presentations,
						{
							id: 'presentation-3',
							label: 'Study',
							views: [{ viewId: 'view-3' }],
							explorable: true,
							subject: null,
							text: null
						}
					],
					stops: [
						jumpFromEntry
							? {
									...base.stops[0]!,
									transition: 'travel'
								}
							: base.stops[0]!,
						{ ...base.stops[1]!, transition: 'travel' },
						{
							id: 'stop-3',
							presentationId: 'presentation-3',
							entryViewId: null,
							staySeconds: 3,
							invitation: null,
							transition: 'cut'
						}
					],
					guides: [{ ...base.guides[0]!, stopIds: ['stop-1', 'stop-2', 'stop-3'] }]
				}
			]
		}
	});
	return lowerExperienceProgram(envelope, LOWERING_OPTIONS);
}

describe('Experience lowering', () => {
	it('derives the entry guide order, the authored Travel and the panel content', async () => {
		const lowered = await program();
		expect(validateExecutionProgram(lowered).success).toBe(true);
		expect(lowered.pacing).toBe('automatic');
		expect(lowered.presentations.find((entry) => entry.id === 'presentation-1')).toMatchObject({
			viewIds: ['view-1'],
			steps: []
		});
		expect(lowered.entryStopId).toBe('stop-1');
		expect(lowered.stops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
		expect(lowered.stops[0]).toMatchObject({
			invocation: { kind: 'cut', viewId: 'view-1' },
			continuation: { kind: 'sequence-next' },
			entryViewId: 'view-1',
			staySeconds: 1,
			invitation: null,
		});
		expect(lowered.stops[1]).toMatchObject({
			invocation: { kind: 'travel', connectionId: 'connection-1' },
			continuation: { kind: 'sequence-next' },
		});
		expect(lowered.localTime).toEqual([
			{ stopId: 'stop-1', staySeconds: 1 },
			{ stopId: 'stop-2', staySeconds: 2 }
		]);
		expect(lowered.presentations.find((entry) => entry.id === 'presentation-1')?.content).toEqual([
			{ id: 'presentation-1:text', kind: 'text', text: 'The piano.' }
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
							{
								id: 'presentation-study',
								label: 'Study',
								views: [{ viewId: 'view-2' }],
								explorable: true,
								subject: null,
								text: null
							}
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
			viewIds: ['view-2'],
			defaultViewId: 'view-2',
			stopIds: []
		});
	});

	it('uses the authored default Cut when a non-entry Stop authors no Travel', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						stops: [
							{ ...base.stops[0]!, transition: 'cut' },
							base.stops[1]!
						]
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		// Cut is the authored default on the edge, not a silent fallback from a
		// Travel: no connection is consulted and there is no host binding to omit.
		expect(lowered.program.stops[1]).toMatchObject({ invocation: { kind: 'cut', viewId: 'view-2' } });
	});

	it('enters a non-first entry Stop with a Cut and keeps its authored approach as a transition', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						guides: [{ ...base.guides[0]!, }]
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, entryStopId: 'stop-2' });
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		expect(lowered.program.entryStopId).toBe('stop-2');
		// The run has visited nothing before its first arrival, so there is no pose a
		// Travel could start from: the entry occurrence cuts to its own View. The
		// authored approach stays in the transition table, so a later navigation
		// from stop-1 still realizes its Travel.
		expect(lowered.program.stops[1]).toMatchObject({
			invocation: { kind: 'cut', viewId: 'view-2' }
		});
		expect(lowered.transitions).toContainEqual({
			fromStopId: 'stop-1',
			toStopId: 'stop-2',
			invocation: { kind: 'travel', connectionId: 'connection-1' }
		});
	});

	it('reports a travel gap when no Camera connection joins the adjacent views', async () => {
		// Connectivity is a Camera fact: with no connection and no adjacency, the
		// authored Travel has no route and must refuse rather than become a Cut.
		const envelope = await experienceEnvelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: VIEWS.map((view) => ({ ...view, connectedViewIds: [] })),
				connections: []
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
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

	it('lowers the Guide’s linear order whatever the old jump authored', async () => {
		const lowered = await threeStopLowering(true);
		expect(lowered.kind).toBe('lowered');
		if (lowered.kind !== 'lowered') return;
		expect(lowered.program.stops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2', 'stop-3']);
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
						formatVersion: 4 as const,
						experiences: envelope.units.experience.data.experiences.map((experience) => ({
							...experience,
							presentations: experience.presentations.map((presentation) =>
								presentation.id === 'presentation-2'
									? { ...presentation, views: [{ viewId: 'view-absent' }] }
									: presentation
							)
						}))
					}
				}
			}
		};
		const lowered = lowerExperienceProgram(broken, LOWERING_OPTIONS);
		expect(lowered).toMatchObject({ kind: 'refused', code: 'unknown-view' });
	});

	it('refuses a Stop whose Presentation has no Default View', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						presentations: base.presentations.map((presentation) =>
							presentation.id === 'presentation-1' ? { ...presentation, views: [] } : presentation
						)
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
		expect(lowered).toMatchObject({ kind: 'refused', code: 'missing-entry' });
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

	it('refuses an order that is not the selected Guide’s own order', async () => {
		const envelope = await experienceEnvelope();
		expect(lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, guideId: 'guide-1', order: ['stop-2'] })).toMatchObject({ kind: 'refused' });
	});

	it('stays for the explicit clock, plays on over the bound Travel and starts the next stay only on arrival', async () => {
		const lowered = await program();
		const interpreter = createExperienceInterpreter(lowered, OPTIONS);
		const entered = interpreter.enter();
		expect(entered.state).toMatchObject({ stopId: 'stop-1', phase: 'holding', holdRemainingMs: 1000 });
		expect(entered.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-1',
			invocation: { kind: 'cut', viewId: 'view-1' }
		});

		expect(interpreter.tick(999).state).toMatchObject({ phase: 'holding', holdRemainingMs: 1 });
		// Automatic: the stay ends and the authored Travel plays on by itself.
		const played = interpreter.tick(1);
		expect(played.state).toMatchObject({ stopId: 'stop-2', phase: 'traveling', holdRemainingMs: null });
		expect(played.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-2',
			invocation: { kind: 'travel', connectionId: 'connection-1' }
		});
		// Ticks during the Travel never count toward the stay.
		expect(interpreter.tick(3000).state).toMatchObject({ phase: 'traveling', holdRemainingMs: null });
		const arrived = interpreter.arrival();
		expect(arrived.state).toMatchObject({ phase: 'holding', holdRemainingMs: 2000 });
		expect(arrived.effects).toEqual([{ kind: 'hold', stopId: 'stop-2', milliseconds: 2000 }]);

		const completed = interpreter.tick(2000);
		expect(completed.state.phase).toBe('completed');
		expect(completed.effects).toContainEqual({ kind: 'completed' });
	});

	it('Next lands an arrival Travel now, ends a stay, and finishes on the last Stop', async () => {
		const lowered = await program();
		const interpreter = createExperienceInterpreter(lowered, OPTIONS);
		interpreter.enter();
		expect(interpreter.continue().state).toMatchObject({ stopId: 'stop-2', phase: 'traveling' });
		const landed = interpreter.continue();
		expect(landed.state).toMatchObject({ stopId: 'stop-2', phase: 'holding', holdRemainingMs: 2000, viewId: 'view-2' });
		expect(landed.effects).toContainEqual({ kind: 'camera', stopId: 'stop-2', invocation: { kind: 'cut', viewId: 'view-2' } });
		expect(landed.state.visited).toHaveLength(2);
		expect(interpreter.continue().state.phase).toBe('completed');
	});

	it('waits for Next at every Stop in Manual pacing, and Travels still play', async () => {
		const base = await program();
		const manual: ExecutionProgram = {
			...base,
			pacing: 'manual',
			stops: base.stops.map((stop) => ({ ...stop, staySeconds: null })),
			localTime: []
		};
		expect(validateExecutionProgram(manual).success).toBe(true);
		const interpreter = createExperienceInterpreter(manual, OPTIONS);
		expect(interpreter.enter().state).toMatchObject({ stopId: 'stop-1', phase: 'ready', holdRemainingMs: null });
		expect(interpreter.tick(60_000).state).toMatchObject({ stopId: 'stop-1', phase: 'ready' });
		expect(interpreter.pause().outcome).toBe('ignored');
		expect(interpreter.continue().state).toMatchObject({ stopId: 'stop-2', phase: 'traveling' });
		const arrived = interpreter.arrival();
		expect(arrived.state).toMatchObject({ stopId: 'stop-2', phase: 'ready' });
		expect(arrived.effects).toEqual([{ kind: 'ready', stopId: 'stop-2' }]);
		expect(interpreter.continue().state.phase).toBe('completed');
	});

	it('pause freezes the Guide clock, mid-Travel included, and Next or Play resumes it', async () => {
		const lowered = await program();
		const interpreter = createExperienceInterpreter(lowered, OPTIONS);
		interpreter.enter();
		interpreter.tick(400);
		expect(interpreter.pause().state).toMatchObject({ paused: true, holdRemainingMs: 600 });
		expect(interpreter.tick(5000)).toMatchObject({ outcome: 'ignored' });
		expect(interpreter.state()).toMatchObject({ holdRemainingMs: 600, elapsedMs: 400 });
		expect(interpreter.play().state.paused).toBe(false);
		interpreter.tick(600);
		expect(interpreter.state()).toMatchObject({ stopId: 'stop-2', phase: 'traveling' });
		interpreter.pause();
		expect(interpreter.tick(100).outcome).toBe('ignored');
		// Next resumes play and lands the arrival.
		expect(interpreter.continue().state).toMatchObject({ paused: false, phase: 'holding' });
	});

	/**
	 * A three-Stop Guide over a three-View Presentation with authored steps, and two
	 * extra Presentations that carry no Stop. Stop-1 stays 1 s, stop-2 enters at
	 * view-2 with a Cut, stop-3 is the last.
	 */
	async function guidedWithExtras(): Promise<ExecutionProgram> {
		const base = await program();
		return {
			...base,
			presentations: [
				{
					...base.presentations[0]!,
					viewIds: ['view-1', 'view-2', 'view-3'],
					steps: [
						{ kind: 'travel', connectionId: 'connection-1' },
						{ kind: 'cut', viewId: 'view-3' }
					]
				},
				...base.presentations.slice(1),
				{ id: 'presentation-extra', label: 'Extra', viewIds: ['view-1'], steps: [], explorable: true, content: [] },
				{ id: 'presentation-extra-2', label: 'Extra two', viewIds: ['view-2'], steps: [], explorable: true, content: [] }
			],
			stops: [
				base.stops[0]!,
				{
					...base.stops[1]!,
					presentationId: 'presentation-1',
					invocation: { kind: 'cut', viewId: 'view-2' },
					continuation: { kind: 'sequence-next' },
					staySeconds: 4,
				},
				{ ...base.stops[0]!, id: 'stop-3', staySeconds: 3 }
			],
			localTime: [
				{ stopId: 'stop-1', staySeconds: 1 },
				{ stopId: 'stop-2', staySeconds: 4 },
				{ stopId: 'stop-3', staySeconds: 3 }
			]
		};
	}

	it('Explore keeps the occurrence suspended, freezes the clock and Back restores the playhead and play state', async () => {
		const extended = await guidedWithExtras();
		expect(validateExecutionProgram(extended).success).toBe(true);
		const interpreter = createExperienceInterpreter(extended, OPTIONS);
		interpreter.enter();
		interpreter.continue();
		interpreter.tick(1500);
		const at = interpreter.state();
		expect(at).toMatchObject({ stopId: 'stop-2', phase: 'holding', holdRemainingMs: 2500, viewId: 'view-2' });

		// Journey B: accept, step along the Presentation, pick a non-adjacent View.
		const explored = interpreter.enterPresentation('presentation-1', 'view-2');
		expect(explored.state).toMatchObject({
			stopId: null,
			presentationId: 'presentation-1',
			viewId: 'view-2',
			viewIndex: 1,
			resume: { stopId: 'stop-2', occurrenceId: at.occurrenceId, viewId: 'view-2', holdRemainingMs: 2500, paused: false }
		});
		expect(explored.effects).toContainEqual({ kind: 'camera', stopId: null, invocation: { kind: 'cut', viewId: 'view-2' } });
		expect(interpreter.tick(10_000).outcome).toBe('ignored');
		// ‹ plays the authored step backwards along its path; › then a pick of View 3 from View 1 is a Cut.
		expect(interpreter.exploreView('view-1').effects).toEqual([
			{ kind: 'camera', stopId: null, invocation: { kind: 'travel', connectionId: 'connection-1' } }
		]);
		expect(interpreter.exploreView('view-3').effects).toEqual([
			{ kind: 'camera', stopId: null, invocation: { kind: 'cut', viewId: 'view-3' } }
		]);
		expect(interpreter.exploreView('view-2').effects).toEqual([
			{ kind: 'camera', stopId: null, invocation: { kind: 'cut', viewId: 'view-2' } }
		]);
		// Next is not the tour's while exploring.
		expect(interpreter.continue().outcome).toBe('ignored');

		const resumed = interpreter.resume();
		expect(resumed.outcome).toBe('accepted');
		expect(resumed.state).toMatchObject({
			stopId: 'stop-2',
			occurrenceId: at.occurrenceId,
			phase: 'holding',
			holdRemainingMs: 2500,
			viewId: 'view-2',
			paused: false,
			resume: null
		});
		expect(resumed.effects).toContainEqual({ kind: 'camera', stopId: 'stop-2', invocation: { kind: 'cut', viewId: 'view-2' } });
		// Back is not a new visit.
		expect(resumed.state.visited).toEqual(at.visited);
		expect(interpreter.tick(2500).state).toMatchObject({ stopId: 'stop-3' });
	});

	it('Back leaves a 2 s lead-in when less of the stay remained', async () => {
		const extended = await guidedWithExtras();
		const interpreter = createExperienceInterpreter(extended, OPTIONS);
		interpreter.enter();
		interpreter.continue();
		interpreter.tick(3200);
		interpreter.enterPresentation('presentation-1');
		expect(interpreter.resume().state).toMatchObject({ stopId: 'stop-2', holdRemainingMs: 2000 });
		// The lead-in never exceeds the stay itself.
		const short = createExperienceInterpreter(extended, OPTIONS);
		short.enter();
		short.tick(900);
		short.enterPresentation('presentation-1');
		expect(short.resume().state).toMatchObject({ stopId: 'stop-1', holdRemainingMs: 1000 });
	});

	it('Explore remembers paused and waiting, and lands an arrival Travel first', async () => {
		const extended = await guidedWithExtras();
		const paused = createExperienceInterpreter(extended, OPTIONS);
		paused.enter();
		paused.pause();
		paused.enterPresentation('presentation-1');
		expect(paused.state().paused).toBe(false);
		expect(paused.resume().state).toMatchObject({ stopId: 'stop-1', paused: true, phase: 'holding' });

		const lowered = await program();
		const travelling = createExperienceInterpreter(lowered, OPTIONS);
		travelling.enter();
		travelling.continue();
		expect(travelling.state().phase).toBe('traveling');
		const landed = travelling.enterPresentation('presentation-2');
		expect(landed.state.resume).toMatchObject({ stopId: 'stop-2', viewId: 'view-2', holdRemainingMs: 2000 });
		expect(travelling.resume().state).toMatchObject({ stopId: 'stop-2', phase: 'holding', holdRemainingMs: 2000 });

		const manual = createExperienceInterpreter(
			{ ...lowered, pacing: 'manual', stops: lowered.stops.map((stop) => ({ ...stop, staySeconds: null })), localTime: [] },
			OPTIONS
		);
		manual.enter();
		manual.enterPresentation('presentation-1');
		expect(manual.resume().state).toMatchObject({ stopId: 'stop-1', phase: 'ready', holdRemainingMs: null });
		expect(manual.continue().state).toMatchObject({ stopId: 'stop-2' });
	});

	it('does not re-run arrival lifecycle actions on Back', async () => {
		const extended = await guidedWithExtras();
		const counted: ExecutionProgram = {
			...extended,
			state: [{ id: 'arrivals', type: 'boolean', values: [], initial: false, reset: false }],
			lifecycle: [{ event: 'arrival', guard: null, action: { kind: 'open-url', url: 'https://example.com/' } }]
		};
		const interpreter = createExperienceInterpreter(counted, OPTIONS);
		expect(interpreter.enter().effects.filter((effect) => effect.kind === 'open-url')).toHaveLength(1);
		interpreter.enterPresentation('presentation-extra');
		expect(interpreter.resume().effects.some((effect) => effect.kind === 'open-url')).toBe(false);
	});

	it('ignores resume when no Guide position is suspended', async () => {
		const extended = await guidedWithExtras();
		const interpreter = createExperienceInterpreter(extended, OPTIONS);
		interpreter.enter();
		const before = interpreter.state();
		expect(interpreter.resume()).toMatchObject({ outcome: 'ignored', effects: [] });
		expect(interpreter.state()).toBe(before);
	});

	it('keeps the original Guide position when moving between Presentations', async () => {
		const extended = await guidedWithExtras();
		const interpreter = createExperienceInterpreter(extended, OPTIONS);
		interpreter.enter();
		interpreter.tick(500);
		interpreter.continue();
		interpreter.enterPresentation('presentation-extra');
		interpreter.enterPresentation('presentation-extra-2');
		expect(interpreter.state().resume).toMatchObject({ stopId: 'stop-2', returnToStopId: null });
		expect(interpreter.resume().state).toMatchObject({ stopId: 'stop-2', resume: null });
	});

	it('clears the suspended Guide position when the visitor navigates to a Stop', async () => {
		const extended = await guidedWithExtras();
		const interpreter = createExperienceInterpreter(extended, OPTIONS);
		interpreter.enter();
		interpreter.tick(500);
		interpreter.continue();
		interpreter.enterPresentation('presentation-extra');
		const navigated = interpreter.navigate('stop-1');
		expect(navigated.state).toMatchObject({ stopId: 'stop-1', resume: null });
		expect(interpreter.resume().outcome).toBe('ignored');
	});

	it('clears the suspended Guide position when the run finishes', async () => {
		const extended = await guidedWithExtras();
		const interpreter = createExperienceInterpreter(extended, OPTIONS);
		interpreter.enter();
		interpreter.tick(500);
		interpreter.continue();
		interpreter.enterPresentation('presentation-extra');
		const finished = interpreter.dispatch({
			kind: 'cancel',
			runId: interpreter.state().runId,
			runEpoch: interpreter.state().runEpoch
		});
		expect(finished.state).toMatchObject({ phase: 'cancelled', resume: null });
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
		state = reduceExperience(lowered, state, event('arrival')).state;
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
		state = reduceExperience(lowered, state, event('arrival')).state;
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
		expect(toStudy.state).toMatchObject({ stopId: 'stop-3', phase: 'traveling' });
		expect(toStudy.effects).toContainEqual({
			kind: 'camera',
			stopId: 'stop-3',
			invocation: { kind: 'travel', connectionId: 'connection-2' }
		});
		expect(toStudy.state.visited.map((visit) => visit.stopId)).toEqual(['stop-1', 'stop-2', 'stop-3']);
	});

	it('does not place another Presentation\'s content in the active panel', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						presentations: base.presentations.map((presentation) =>
							presentation.id === 'presentation-2'
								? { ...presentation, text: { kind: 'plain' as const, body: 'The gallery.' } }
								: presentation
						)
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		const selected: ExecutionProgram = {
			...lowered.program,
			lifecycle: [
				{ event: 'arrival', guard: null, action: { kind: 'show-content', contentId: 'presentation-2:text' } }
			]
		};
		const entered = reduceExperience(selected, createExperienceRun(selected, OPTIONS), event('enter'));
		expect(entered.state.panel).toMatchObject({
			presentationId: 'presentation-1',
			content: [{ id: 'presentation-1:text', text: 'The piano.' }]
		});
		expect(entered.state.panel?.content.some((record) => record.id === 'presentation-2:text')).toBe(false);
		expect(entered.effects.some((effect) => effect.kind === 'gap' && effect.message.includes('presentation-2:text'))).toBe(true);
	});

	it('Next during a stay ends it and moves on', async () => {
		const lowered = await program();
		const state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter'));
		const next = reduceExperience(lowered, state.state, event('continue'));
		expect(next).toMatchObject({ outcome: 'accepted', state: { phase: 'traveling', stopId: 'stop-2' } });
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
		state = reduceExperience(lowered, state, event('arrival', {}, options), options).state;
		const returned = reduceExperience(lowered, state, event('continue', {}, options), options);
		// Returning re-enters the origin occurrence as a fresh invocation, including
		// its authored finite stay; only the return obligation is discharged.
		expect(returned.state).toMatchObject({ stopId: 'stop-1', phase: 'holding', holdRemainingMs: 1000 });
		expect(returned.state.returnToStopId).toBeNull();
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
			event('tick', { milliseconds: 750 }),
			event('pause'),
			event('tick', { milliseconds: 750 }),
			event('play'),
			event('arrival'),
			event('tick', { milliseconds: 2000 })
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
		const third = { ...base.stops[0]!, id: 'stop-3' };
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
		const third = { ...base.stops[0]!, id: 'stop-3', transition: 'cut' };
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
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						presentations: base.presentations.map((presentation) =>
							presentation.id === 'presentation-2'
								? { ...presentation, text: { kind: 'plain' as const, body: 'The gallery.' } }
								: presentation
						)
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		// presentation-2:text belongs to presentation-2; the entry arrival is presentation-1.
		const selected: ExecutionProgram = {
			...lowered.program,
			lifecycle: [{ event: 'enter', guard: null, action: { kind: 'show-content', contentId: 'presentation-2:text' } }]
		};
		const entered = reduceExperience(selected, createExperienceRun(selected, OPTIONS), event('enter'));
		expect(entered.state.panel?.content).toEqual([{ id: 'presentation-1:text', text: 'The piano.' }]);
		expect(entered.effects.some((effect) => effect.kind === 'gap' && effect.message.includes('presentation-2:text'))).toBe(true);
	});

	it('resolves a lifecycle continue after arrival only when the Stop waits, never through a stay', async () => {
		const base = await program();
		const auto: ExecutionProgram = {
			...base,
			lifecycle: [{ event: 'arrival', guard: null, action: { kind: 'continue' } }]
		};
		// The entry occurrence stays, so its arrival cannot be continued by the action.
		const held = reduceExperience(auto, createExperienceRun(auto, OPTIONS), event('enter'));
		expect(held.state).toMatchObject({ stopId: 'stop-1', phase: 'holding' });
		// A waiting (Manual) occurrence continues once, and the action is not replayed later.
		const manual: ExecutionProgram = {
			...auto,
			pacing: 'manual',
			stops: auto.stops.map((stop) => ({ ...stop, staySeconds: null, invocation: { kind: 'cut' as const, viewId: stop.entryViewId } })),
			localTime: []
		};
		const advanced = reduceExperience(manual, createExperienceRun(manual, OPTIONS), event('enter'));
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
		state = reduceExperience(ending, state, event('arrival')).state;
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
	it('derives detours from the authored Experience, not from the caller', async () => {
		const authored = {
			...EXPERIENCE,
			experiences: [
				{
					...EXPERIENCE.experiences[0]!,
					detours: [{ id: 'detour-1', fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' }]
				}
			]
		};
		const envelope = await experienceEnvelope({ experience: authored });
		expect(deriveExperienceRuntimePolicy(envelope, 'experience-1')).toEqual({
			kind: 'derived',
			policy: { detours: [{ fromStopId: 'stop-1', toStopId: 'stop-2', returnToStopId: 'stop-1' }] }
		});
	});

	it('refuses a detour that names a Stop the Experience does not carry', async () => {
		const envelope = await experienceEnvelope();
		const dangling: typeof envelope = {
			...envelope,
			units: {
				...envelope.units,
				experience: {
					...envelope.units.experience,
					data: {
						...envelope.units.experience.data,
						experiences: envelope.units.experience.data.experiences.map((experience) => ({
							...experience,
							detours: [{ id: 'detour-1', fromStopId: 'stop-1', toStopId: 'stop-absent', returnToStopId: 'stop-1' }]
						}))
					}
				}
			}
		};
		expect(deriveExperienceRuntimePolicy(dangling, 'experience-1').kind).toBe('refused');
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

	it('offers Next at every Stop, during a stay and during an arrival alike', async () => {
		const lowered = await program();
		let state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		expect(buildExperienceCompanion(lowered, state).continueControl).toEqual({
			available: true,
			label: 'Next',
			reason: null,
			stopId: 'stop-1',
			occurrenceId: 'run-1:stop-1:1'
		});
		state = reduceExperience(lowered, state, event('continue')).state;
		expect(state.phase).toBe('traveling');
		expect(buildExperienceCompanion(lowered, state).continueControl).toMatchObject({ available: true, stopId: 'stop-2' });
		state = reduceExperience(lowered, state, event('pause')).state;
		expect(buildExperienceCompanion(lowered, state).announcements).toContain('The tour is paused.');
	});

	it('clears the current destination and bounded progress when the run ends', async () => {
		const lowered = await program();
		let state = reduceExperience(lowered, createExperienceRun(lowered, OPTIONS), event('enter')).state;
		state = reduceExperience(lowered, state, event('tick', { milliseconds: 500 })).state;
		state = reduceExperience(lowered, state, event('continue')).state;
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

describe('Presentation explore steps (sheet §31)', () => {
	async function stepped(transition: 'cut' | 'travel', connections = CONNECTIONS) {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: connections.length === 0 ? VIEWS.map((view) => ({ ...view, connectedViewIds: [] })) : VIEWS,
				connections
			},
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						presentations: base.presentations.map((presentation) =>
							presentation.id === 'presentation-1'
								? { ...presentation, views: [{ viewId: 'view-1', transition }, { viewId: 'view-2' }] }
								: presentation
						),
						stops: base.stops.map((stop) =>
							stop.id === 'stop-1' ? { ...stop, transition: 'cut' } : stop
						)
					}
				]
			}
		});
		return lowerExperienceProgram(envelope, LOWERING_OPTIONS);
	}

	it('lowers a Cut step and a Travel step bound to the one Camera path, adding no Guide time', async () => {
		const cut = await stepped('cut');
		if (cut.kind !== 'lowered') throw new Error(cut.message);
		expect(cut.program.presentations[0]).toMatchObject({ viewIds: ['view-1', 'view-2'], steps: [{ kind: 'cut', viewId: 'view-2' }] });
		const travel = await stepped('travel');
		if (travel.kind !== 'lowered') throw new Error(travel.message);
		expect(travel.program.presentations[0]!.steps).toEqual([{ kind: 'travel', connectionId: 'connection-1' }]);
		expect(travel.program.localTime).toEqual(cut.program.localTime);
	});

	it('refuses Preview with a typed gap when an explore Travel has no path, never a silent Cut', async () => {
		const gap = await stepped('travel', []);
		expect(gap).toMatchObject({ kind: 'refused', code: 'travel-gap', presentationId: 'presentation-1' });
	});

	it('lowers a Stop that enters at its own View and its invitation; Manual lowers every stay to null', async () => {
		const base = EXPERIENCE.experiences[0]!;
		const envelope = await experienceEnvelope({
			experience: {
				...EXPERIENCE,
				experiences: [
					{
						...base,
						presentations: base.presentations.map((presentation) =>
							presentation.id === 'presentation-2'
								? { ...presentation, views: [{ viewId: 'view-2' }, { viewId: 'view-1' }] }
								: presentation
						),
						stops: base.stops.map((stop) =>
							stop.id === 'stop-2'
								? { ...stop, entryViewId: 'view-1', invitation: { prompt: 'Look closer' } }
								: { ...stop, transition: 'cut' }
						),
						guides: base.guides.map((guide) => ({ ...guide, pacing: 'manual' as const }))
					}
				]
			}
		});
		const lowered = lowerExperienceProgram(envelope, LOWERING_OPTIONS);
		if (lowered.kind !== 'lowered') throw new Error(lowered.message);
		expect(lowered.program.pacing).toBe('manual');
		expect(lowered.program.localTime).toEqual([]);
		expect(lowered.program.stops[1]).toMatchObject({
			entryViewId: 'view-1',
			staySeconds: null,
			invitation: { prompt: 'Look closer' },
			invocation: { kind: 'cut', viewId: 'view-1' }
		});
	});
});
