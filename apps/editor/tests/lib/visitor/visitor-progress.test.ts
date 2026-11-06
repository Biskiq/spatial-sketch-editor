import { describe, expect, it } from 'vitest';
import type { ExecutionProgram } from '@portfolio/project-model/units';
import { createVisitorRuntimeState } from '$lib/visitor/visitor-runtime-state.svelte';
import { visitorProgressFor } from '$lib/visitor/visitor-progress';

function program(overrides: Partial<ExecutionProgram> = {}): ExecutionProgram {
	return {
		kind: 'execution-program',
		formatVersion: 4,
		capabilities: [],
		welcome: null,
		experienceId: 'experience-1',
		entryStopId: 'stop-1',
		pacing: 'automatic',
		presentations: [
			{ id: 'presentation-1', label: 'Piano', viewIds: ['view-1'], steps: [], explorable: true, content: [] },
			{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], steps: [], explorable: true, content: [] }
		],
		stops: [
			{ id: 'stop-1', presentationId: 'presentation-1', entryViewId: 'view-1', staySeconds: 5, invitation: null, invocation: { kind: 'cut', viewId: 'view-1' }, continuation: { kind: 'sequence-next' } },
			{ id: 'stop-2', presentationId: 'presentation-2', entryViewId: 'view-2', staySeconds: 5, invitation: null, invocation: { kind: 'cut', viewId: 'view-2' }, continuation: { kind: 'sequence-next' } },
			{ id: 'stop-3', presentationId: 'presentation-1', entryViewId: 'view-1', staySeconds: 5, invitation: null, invocation: { kind: 'cut', viewId: 'view-1' }, continuation: { kind: 'sequence-next' } }
		],
		state: [],
		localTime: [],
		channels: [],
		lifecycle: [],
		profile: { reducedMotion: 'required', semanticDomNavigation: 'required' },
		...overrides
	};
}

function runtime(source = program()) {
	return createVisitorRuntimeState({
		program: source,
		options: { runId: 'run-1', runEpoch: 1, sourceContentId: 'sha256-source-1' }
	});
}

describe('visitor progress', () => {
	it('R21: fills the stay, freezes while paused or exploring, and restores the lead-in on Back', () => {
		const visitor = runtime();
		visitor.enter();
		visitor.tick(1000);
		let progress = visitorProgressFor(visitor.program, visitor.state);
		expect(progress.segments[0]).toMatchObject({ current: true, visited: true });
		expect(progress.segments[0]!.fill).toBeCloseTo(0.2, 6);

		visitor.pause();
		const paused = progress.segments[0]!.fill;
		visitor.tick(3000);
		progress = visitorProgressFor(visitor.program, visitor.state);
		expect(progress.segments[0]!.fill).toBe(paused);

		visitor.play();
		visitor.tick(3500);
		visitor.pause();
		visitor.explore();
		const exploring = visitorProgressFor(visitor.program, visitor.state).segments[0]!.fill;
		visitor.tick(3000);
		expect(visitorProgressFor(visitor.program, visitor.state).segments[0]!.fill).toBe(exploring);
		visitor.resume();
		const resumed = visitorProgressFor(visitor.program, visitor.state).segments[0]!.fill;
		expect(resumed).toBeLessThan(exploring);
	});

	it('R21: a Travel fills the connector into the arriving segment', () => {
		const visitor = runtime(program({
			stops: program().stops.map((stop, index) => index === 1 ? { ...stop, invocation: { kind: 'travel' as const, connectionId: 'connection-12' } } : stop)
		}));
		visitor.enter();
		visitor.continue();
		expect(visitor.traveling).toBe(true);
		const progress = visitorProgressFor(visitor.program, visitor.state, { travelProgress: 0.4 });
		expect(progress.segments[1]).toMatchObject({ current: true, travelFill: 0.4 });
	});

	it('R22: Manual outlines the current segment and leaves it unfilled', () => {
		const manual = program({
			pacing: 'manual',
			stops: program().stops.map((stop) => ({ ...stop, staySeconds: null }))
		});
		const visitor = runtime(manual);
		visitor.enter();
		expect(visitorProgressFor(visitor.program, visitor.state).segments[0]).toMatchObject({
			current: true,
			outline: true,
			fill: 0
		});
	});

	it('R23: a revisit is its own segment and a forward jump does not mark skipped Stops', () => {
		const visitor = runtime();
		visitor.enter();
		visitor.navigate('stop-3');
		const progress = visitorProgressFor(visitor.program, visitor.state);
		expect(progress.segments.map((segment) => segment.stopId)).toEqual(['stop-1', 'stop-2', 'stop-3']);
		expect(progress.segments.map((segment) => segment.visited)).toEqual([true, false, true]);
		expect(progress.segments[1]).toMatchObject({ fill: 0, travelFill: 0 });
		expect(progress.segments[2]).toMatchObject({ current: true, travelFill: 1 });
	});
});