import { describe, expect, it } from 'vitest';
import type { ExecutionProgram } from '@portfolio/project-model/units';
import { createVisitorRuntimeState } from '$lib/visitor/visitor-runtime-state.svelte';

/**
 * A two-Stop guided Experience. There is no navigation graph, no node order and
 * no `nextNodeId`: the run is entirely Experience-unit orchestration (AM-9).
 * Manual pacing by default, so each Stop waits for Next; `automatic()` times them.
 */
function program(overrides: Partial<ExecutionProgram> = {}): ExecutionProgram {
	return {
		kind: 'execution-program',
		formatVersion: 4,
		capabilities: [],
		welcome: null,
		experienceId: 'experience-1',
		entryStopId: 'stop-1',
		pacing: 'manual',
		presentations: [
			{
				id: 'presentation-1',
				label: 'Piano',
				viewIds: ['view-1', 'view-3'],
				steps: [{ kind: 'travel', connectionId: 'connection-13' }],
				explorable: true,
				content: [{ id: 'content-1', kind: 'text', text: 'The piano.' }]
			},
			{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], steps: [], explorable: true, content: [] },
			{
				id: 'presentation-guide-free',
				label: 'Study',
				viewIds: ['view-3'],
				steps: [],
				explorable: true,
				content: []
			}
		],
		stops: [
			{
				id: 'stop-1',
				presentationId: 'presentation-1',
				entryViewId: 'view-1',
				staySeconds: null,
				invitation: { prompt: null },
				invocation: { kind: 'cut', viewId: 'view-1' },
				continuation: { kind: 'sequence-next' },
			},
			{
				id: 'stop-2',
				presentationId: 'presentation-2',
				entryViewId: 'view-2',
				staySeconds: null,
				invitation: null,
				invocation: { kind: 'cut', viewId: 'view-2' },
				continuation: { kind: 'sequence-next' },
			}
		],
		state: [],
		localTime: [],
		channels: [],
		lifecycle: [],
		profile: { reducedMotion: 'required', semanticDomNavigation: 'required' },
		...overrides
	};
}

function automatic(stays: readonly [number, number] = [0.5, 2], arrival: ExecutionProgram['stops'][number]['invocation'] = { kind: 'cut', viewId: 'view-2' }) {
	const base = program();
	return {
		pacing: 'automatic' as const,
		stops: [
			{ ...base.stops[0]!, staySeconds: stays[0] },
			{ ...base.stops[1]!, staySeconds: stays[1], invocation: arrival }
		],
		localTime: [
			{ stopId: 'stop-1', staySeconds: stays[0] },
			{ stopId: 'stop-2', staySeconds: stays[1] }
		]
	};
}

function runtime(overrides: Partial<ExecutionProgram> = {}) {
	return createVisitorRuntimeState({
		program: program(overrides),
		options: { runId: 'run-1', runEpoch: 1, sourceContentId: 'sha256-source-1' }
	});
}

describe('Experience visitor runtime (no node-keyed orchestration)', () => {
	it('starts neutral and enters at the authored entry Stop', () => {
		const visitor = runtime();
		expect(visitor.currentViewId).toBeNull();
		expect(visitor.state.stopId).toBeNull();
		visitor.enter();
		expect(visitor.state.stopId).toBe('stop-1');
		expect(visitor.currentViewId).toBe('view-1');
		expect(visitor.currentInvocation).toEqual({ kind: 'cut', viewId: 'view-1' });
		expect(visitor.waiting).toBe(true);
		expect(visitor.invitation).toEqual({ prompt: null });
	});

	it('advances only through the authored continuation', () => {
		const visitor = runtime();
		visitor.enter();
		visitor.continue();
		expect(visitor.state.stopId).toBe('stop-2');
		expect(visitor.currentViewId).toBe('view-2');
		visitor.continue();
		expect(visitor.state.phase).toBe('completed');
		expect(visitor.currentViewId).toBe('view-2');
		expect(visitor.ended).toBe(true);
	});

	it('a Guide-free program stays enterable from the list', () => {
		const visitor = runtime({ entryStopId: null, stops: [] });
		visitor.start(null);
		expect(visitor.state.phase).toBe('ready');
		expect(visitor.state.stopId).toBeNull();
		expect(visitor.selectPresentation('presentation-guide-free')).toBe(true);
		expect(visitor.currentViewId).toBe('view-3');
	});

	it('keeps a Guide-free Presentation reachable in the companion', () => {
		const visitor = runtime();
		visitor.enter();
		const companion = visitor.companion;
		expect(companion.destinations.map((destination) => destination.stopId)).toEqual(['stop-1', 'stop-2']);
		expect(companion.presentations).toContainEqual({
			presentationId: 'presentation-guide-free',
			label: 'Study',
			viewIds: ['view-3'],
			defaultViewId: 'view-3',
			stopIds: []
		});
	});

	it('stays on the explicit clock and plays on in Automatic', () => {
		const visitor = runtime(automatic());
		visitor.enter();
		expect(visitor.state.phase).toBe('holding');
		visitor.tick(600);
		expect(visitor.state.stopId).toBe('stop-2');
		expect(visitor.state.phase).toBe('holding');
	});

	it('accumulates fractional frame milliseconds so a stay actually expires', () => {
		const visitor = runtime(automatic());
		visitor.enter();
		for (let frame = 0; frame < 31; frame += 1) visitor.tick(1000 / 60);
		expect(visitor.state.stopId).toBe('stop-2');
	});

	it('starts a stay only once its arrival Travel is confirmed', () => {
		const visitor = runtime(automatic([0.5, 2], { kind: 'travel', connectionId: 'connection-12' }));
		visitor.enter();
		visitor.tick(500);
		expect(visitor.traveling).toBe(true);
		expect(visitor.takeTickMotions()).toEqual([
			{ invocation: { kind: 'travel', connectionId: 'connection-12' }, viewId: 'view-2' }
		]);
		visitor.tick(5000);
		expect(visitor.state.holdRemainingMs).toBeNull();
		visitor.arrival();
		expect(visitor.state).toMatchObject({ phase: 'holding', holdRemainingMs: 2000 });
	});

	it('keeps one pause flag in run state; Next resumes play', () => {
		const visitor = runtime(automatic());
		visitor.enter();
		visitor.pause();
		expect(visitor.paused).toBe(true);
		visitor.tick(5000);
		expect(visitor.state).toMatchObject({ stopId: 'stop-1', holdRemainingMs: 500 });
		visitor.continue();
		expect(visitor.paused).toBe(false);
		expect(visitor.state.stopId).toBe('stop-2');
		// Manual has nothing to pause.
		const manual = runtime();
		manual.enter();
		manual.pause();
		expect(manual.paused).toBe(false);
	});

	it('explores the Stop from its View, steps the Presentation and returns to the same occurrence', () => {
		const visitor = runtime(automatic([4, 2]));
		visitor.enter();
		visitor.tick(1500);
		const occurrence = visitor.state.occurrenceId;
		expect(visitor.explore()).toBe(true);
		expect(visitor.exploring).toBe(true);
		expect(visitor.currentViewId).toBe('view-1');
		visitor.tick(10_000);
		expect(visitor.state.resume?.holdRemainingMs).toBe(2500);
		expect(visitor.exploreStep(1)).toBe(true);
		expect(visitor.currentInvocation).toEqual({ kind: 'travel', connectionId: 'connection-13' });
		expect(visitor.currentViewId).toBe('view-3');
		expect(visitor.exploreStep(1)).toBe(false);
		// Places keeps the one resume point.
		expect(visitor.selectPresentation('presentation-guide-free')).toBe(true);
		visitor.resume();
		expect(visitor.exploring).toBe(false);
		expect(visitor.state).toMatchObject({ stopId: 'stop-1', occurrenceId: occurrence, holdRemainingMs: 2500, viewId: 'view-1' });
	});

	it('selects a Stop-free Presentation as a real Camera destination', () => {
		const visitor = runtime();
		visitor.enter();
		expect(visitor.selectPresentation('presentation-guide-free')).toBe(true);
		expect(visitor.currentPresentation?.id).toBe('presentation-guide-free');
		expect(visitor.currentViewId).toBe('view-3');
		expect(visitor.currentInvocation).toEqual({ kind: 'cut', viewId: 'view-3' });
		expect(visitor.selectPresentation('presentation-absent')).toBe(false);
		visitor.navigate('stop-2');
		expect(visitor.currentPresentation?.id).toBe('presentation-2');
		expect(visitor.currentViewId).toBe('view-2');
		expect(visitor.canResume).toBe(false);
	});

	it('offers Back only while a Stop is suspended, and Next never returns', () => {
		const visitor = runtime();
		visitor.enter();
		visitor.continue();
		expect(visitor.canResume).toBe(false);
		expect(visitor.selectPresentation('presentation-guide-free')).toBe(true);
		expect(visitor.canResume).toBe(true);
		visitor.continue();
		expect(visitor.currentPresentation?.id).toBe('presentation-guide-free');
		visitor.resume();
		expect(visitor.canResume).toBe(false);
		expect(visitor.state.stopId).toBe('stop-2');
		expect(visitor.currentViewId).toBe('view-2');
		expect(visitor.waiting).toBe(true);
	});

	it('Prev cuts to the previous Stop entry View', () => {
		const visitor = runtime({
			stops: program().stops.map((stop) => (stop.id === 'stop-1' ? { ...stop, entryViewId: 'view-3', invocation: { kind: 'cut' as const, viewId: 'view-3' } } : stop))
		});
		visitor.enter();
		visitor.continue();
		expect(visitor.previousStop()).toBe(true);
		expect(visitor.state).toMatchObject({ stopId: 'stop-1', viewId: 'view-3' });
		expect(visitor.currentInvocation).toEqual({ kind: 'cut', viewId: 'view-3' });
		expect(visitor.previousStop()).toBe(false);
	});

	it('treats an empty program as an explicit neutral state', () => {
		const visitor = runtime({ entryStopId: null, stops: [] });
		visitor.enter();
		expect(visitor.ended).toBe(true);
		expect(visitor.currentViewId).toBeNull();
	});

	it('lists Places in program order, only those Listed in Places', () => {
		const base = program();
		const visitor = runtime({
			presentations: [
				base.presentations[2]!,
				{ ...base.presentations[0]!, explorable: false },
				base.presentations[1]!
			]
		});
		expect(visitor.freePresentations.map((presentation) => presentation.id)).toEqual([
			'presentation-guide-free', 'presentation-2'
		]);
		expect(visitor.selectPresentation('presentation-1')).toBe(false);
		expect(visitor.selectPresentation('presentation-2')).toBe(true);
		expect(visitor.currentViewId).toBe('view-2');
		expect(visitor.currentViewIndex).toBe(0);
	});
});
