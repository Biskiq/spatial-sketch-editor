import { describe, expect, it } from 'vitest';
import type { ExecutionProgram } from '@portfolio/project-model/units';
import { createVisitorRuntimeState } from '$lib/visitor/visitor-runtime-state.svelte';

/**
 * A two-Stop guided Experience. There is no navigation graph, no node order and
 * no `nextNodeId`: the run is entirely Experience-unit orchestration (AM-9).
 */
function program(overrides: Partial<ExecutionProgram> = {}): ExecutionProgram {
	return {
		kind: 'execution-program',
		formatVersion: 2,
		capabilities: [],
		experienceId: 'experience-1',
		entryStopId: 'stop-1',
		presentations: [
			{
				id: 'presentation-1',
				label: 'Piano',
				viewIds: ['view-1'],
				defaultViewId: 'view-1',
				content: [{ id: 'content-1', kind: 'text', text: 'The piano.' }]
			},
			{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], defaultViewId: 'view-2', content: [] },
			{
				id: 'presentation-guide-free',
				label: 'Study',
				viewIds: ['view-3'],
				defaultViewId: 'view-3',
				content: []
			}
		],
		stops: [
			{
				id: 'stop-1',
				presentationId: 'presentation-1',
				viewId: 'view-1',
				invocation: { kind: 'cut', viewId: 'view-1' },
				holdSeconds: null,
				continuation: { kind: 'sequence-next' }
			},
			{
				id: 'stop-2',
				presentationId: 'presentation-2',
				viewId: 'view-2',
				invocation: { kind: 'cut', viewId: 'view-2' },
				holdSeconds: null,
				continuation: { kind: 'end' }
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
	});

	it('advances only through the authored continuation', () => {
		const visitor = runtime();
		visitor.enter();
		visitor.continue();
		expect(visitor.state.stopId).toBe('stop-2');
		expect(visitor.currentViewId).toBe('view-2');
		visitor.continue();
		expect(visitor.state.phase).toBe('completed');
		// The final camera pose stays where the last Stop left it; the run is ended
		// and no further Continue is accepted.
		expect(visitor.currentViewId).toBe('view-2');
		expect(visitor.ended).toBe(true);
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

	it('holds on the explicit clock and auto-continues on expiry', () => {
		const visitor = runtime({
			stops: [
				{
					id: 'stop-1',
					presentationId: 'presentation-1',
					viewId: 'view-1',
					invocation: { kind: 'cut', viewId: 'view-1' },
					holdSeconds: 0.5,
					continuation: { kind: 'sequence-next' }
				},
				{
					id: 'stop-2',
					presentationId: 'presentation-2',
					viewId: 'view-2',
					invocation: { kind: 'cut', viewId: 'view-2' },
					holdSeconds: null,
					continuation: { kind: 'end' }
				}
			]
		});
		visitor.enter();
		expect(visitor.state.phase).toBe('holding');
		visitor.continue();
		expect(visitor.state.stopId).toBe('stop-1');
		visitor.tick(600);
		expect(visitor.state.stopId).toBe('stop-2');
	});

	it('selects a Stop-free Presentation as a real Camera destination', () => {
		const visitor = runtime();
		visitor.enter();
		expect(visitor.selectPresentation('presentation-guide-free')).toBe(true);
		expect(visitor.currentPresentation?.id).toBe('presentation-guide-free');
		expect(visitor.currentViewId).toBe('view-3');
		// The detached Presentation is a Cut. Replaying the entry Stop's invocation
		// here would ask Camera for a connection the visitor never travelled.
		expect(visitor.currentInvocation).toEqual({ kind: 'cut', viewId: 'view-3' });
		expect(visitor.selectPresentation('presentation-absent')).toBe(false);
		// An explicit Stop navigation leaves the Stop-free selection behind.
		visitor.navigate('stop-2');
		expect(visitor.currentPresentation?.id).toBe('presentation-2');
		expect(visitor.currentViewId).toBe('view-2');
		// `enter()` is idempotent: it never restarts an entered run, so a detached
		// Presentation stays until a real arrival replaces it.
		visitor.selectPresentation('presentation-guide-free');
		visitor.enter();
		expect(visitor.currentPresentation?.id).toBe('presentation-guide-free');
		expect(visitor.currentViewId).toBe('view-3');
	});

	it('keeps a detached Presentation until a real arrival replaces it', () => {
		const visitor = runtime({
			stops: [
				{
					id: 'stop-1',
					presentationId: 'presentation-1',
					viewId: 'view-1',
					invocation: { kind: 'cut', viewId: 'view-1' },
					holdSeconds: 0.5,
					continuation: { kind: 'sequence-next' }
				},
				{
					id: 'stop-2',
					presentationId: 'presentation-2',
					viewId: 'view-2',
					invocation: { kind: 'cut', viewId: 'view-2' },
					holdSeconds: null,
					continuation: { kind: 'end' }
				}
			]
		});
		visitor.enter();
		expect(visitor.state.phase).toBe('holding');
		visitor.selectPresentation('presentation-guide-free');
		expect(visitor.currentViewId).toBe('view-3');

		// Presentation entry ends the occurrence: no Stop and no hold remain, so
		// Continue has nothing to advance and the explicit clock cannot move it.
		expect(visitor.state.stopId).toBeNull();
		expect(visitor.state.phase).toBe('ready');
		visitor.continue();
		expect(visitor.currentViewId).toBe('view-3');
		visitor.tick(600);
		expect(visitor.currentViewId).toBe('view-3');

		// A real arrival replaces the detached Presentation and its View.
		visitor.navigate('stop-2');
		expect(visitor.state.stopId).toBe('stop-2');
		expect(visitor.state.presentationId).toBe('presentation-2');
		expect(visitor.currentViewId).toBe('view-2');
	});

	it('accumulates fractional frame milliseconds so a hold actually expires', () => {
		const visitor = runtime({
			stops: [
				{
					id: 'stop-1',
					presentationId: 'presentation-1',
					viewId: 'view-1',
					invocation: { kind: 'cut', viewId: 'view-1' },
					holdSeconds: 0.5,
					continuation: { kind: 'sequence-next' }
				},
				{
					id: 'stop-2',
					presentationId: 'presentation-2',
					viewId: 'view-2',
					invocation: { kind: 'cut', viewId: 'view-2' },
					holdSeconds: null,
					continuation: { kind: 'end' }
				}
			]
		});
		visitor.enter();
		expect(visitor.state.phase).toBe('holding');
		// 60 fps deltas are fractional; the integer-only interpreter used to reject
		// every frame, so a hold never expired.
		for (let frame = 0; frame < 31; frame += 1) visitor.tick(1000 / 60);
		expect(visitor.state.stopId).toBe('stop-2');
		expect(visitor.state.phase).toBe('ready');
	});

	it('treats an empty program as an explicit neutral state', () => {
		const visitor = runtime({ entryStopId: null, stops: [] });
		visitor.enter();
		expect(visitor.ended).toBe(true);
		expect(visitor.currentViewId).toBeNull();
	});
});
