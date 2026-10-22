// @vitest-environment jsdom
/**
 * Mounted Camera-handoff evidence (T3.P01.S04 review follow-up).
 *
 * Runtime blockers are exercised against the real `VisitorCameraDirector` and
 * the real `VisitorRuntimeState`, with Threlte's canvas/camera replaced by test
 * doubles because jsdom has no WebGL:
 *
 * 1. `VisitorRuntimeState.state` must be reactive, or a Stop/phase change never
 *    reaches the Camera and the visitor surface freezes on its first frame.
 * 2. A hold tick replaces the interpreter state. While a Travel is in flight the
 *    Camera-view target and the realized view differ, so a reactive re-run must
 *    not start the same Travel again from mid-flight.
 * 3. An explicit Cut to the in-flight destination, a Cut back to the origin, or
 *    a reduced-motion toggle must settle immediately instead of being mistaken
 *    for another hold tick.
 * 4. An authored hold can expire before its Travel reaches the Stop it belongs
 *    to. The next Travel then overtakes the unfinished one; the Camera must
 *    realize the new authored connection from its live pose (a declared
 *    handoff), not mistake it for an endpoint mismatch and Cut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
	tasks: [] as Array<(delta: number) => void>,
	starts: [] as unknown[]
}));

vi.mock('@threlte/core', async () => {
	const { default: PerspectiveCamera } = await import('./fixtures/MockPerspectiveCamera.svelte');
	return {
		T: { PerspectiveCamera },
		useTask: (callback: (delta: number) => void) => {
			harness.tasks.push(callback);
			return { stop() {} };
		},
		useThrelte: () => ({ canvas: document.createElement('canvas') })
	};
});

vi.mock('@threlte/extras', async () => {
	const { default: OrbitControls } = await import('./fixtures/MockOrbitControls.svelte');
	return { OrbitControls };
});

vi.mock('@portfolio/camera-core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@portfolio/camera-core')>();
	return {
		...actual,
		createCameraMotion: (...args: Parameters<typeof actual.createCameraMotion>) => {
			harness.starts.push(args[0]);
			return actual.createCameraMotion(...args);
		}
	};
});

import { mount, tick, unmount } from 'svelte';
import type {
	ExecutionProgram,
	ExperienceInterpreterOptions
} from '@portfolio/project-model/units';
import type { NavigationGraph, NavigationNodeData } from '@portfolio/project-model';
import VisitorCameraDirector from '$lib/visitor/VisitorCameraDirector.svelte';
import { createVisitorRuntimeState, type VisitorRuntimeState } from '$lib/visitor/visitor-runtime-state.svelte';
import VisitorRuntimeProbe from './fixtures/VisitorRuntimeProbe.svelte';

const OPTIONS: ExperienceInterpreterOptions = {
	runId: 'run-director',
	runEpoch: 1,
	sourceContentId: 'sha256-director'
};

const NODES: NavigationNodeData[] = [
	{
		id: 'view-1',
		label: 'Entrance',
		position: [0, 1.6, 0],
		cameraTarget: [0, 1.6, -1],
		fov: 54,
		connectedNodeIds: ['view-2']
	},
	{
		id: 'view-2',
		label: 'Gallery',
		position: [4, 1.6, 0],
		cameraTarget: [4, 1.6, -1],
		fov: 54,
		connectedNodeIds: ['view-1']
	}
];

function connection(id: string, durationSeconds: number) {
	return {
		id,
		fromNodeId: 'view-1',
		toNodeId: 'view-2',
		positionPath: {
			kind: 'rounded-polyline' as const,
			anchors: [
				{ id: `${id}-start`, position: [0, 1.6, 0] as [number, number, number] },
				{ id: `${id}-end`, position: [4, 1.6, 0] as [number, number, number] }
			]
		},
		clearance: 1.2,
		timing: { forward: { durationSeconds } }
	};
}

function graph(): NavigationGraph {
	return {
		navigationNodes: NODES,
		connections: [connection('connection-1', 5), connection('connection-2', 5)],
		nodeById: new Map(NODES.map((node) => [node.id, node]))
	};
}

/**
 * Two authored Stops. The second is reached by an explicit Travel on
 * `connection-2`, with a hold long enough that hold ticks run while the Camera
 * is still traveling (the motion is authored at five seconds).
 */
function program(overrides: Partial<ExecutionProgram> = {}): ExecutionProgram {
	return {
		kind: 'execution-program',
		formatVersion: 2,
		capabilities: [],
		experienceId: 'experience-director',
		entryStopId: 'stop-1',
		presentations: [
			{ id: 'presentation-1', label: 'Entrance', viewIds: ['view-1'], defaultViewId: 'view-1', content: [] },
			{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], defaultViewId: 'view-2', content: [] },
			{ id: 'presentation-guide-free', label: 'Study', viewIds: ['view-1'], defaultViewId: 'view-1', content: [] }
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
				invocation: { kind: 'travel', connectionId: 'connection-2' },
				holdSeconds: 1,
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

function runtime(overrides: Partial<ExecutionProgram> = {}): VisitorRuntimeState {
	return createVisitorRuntimeState({ program: program(overrides), options: OPTIONS });
}

type MockCamera = {
	readonly copies: number;
	readonly lastPoint: { x: number; y: number; z: number };
};

function mockCamera(): MockCamera {
	const camera = (globalThis as { __visitorMockCamera?: MockCamera }).__visitorMockCamera;
	if (camera === undefined) throw new Error('the mocked Camera is not mounted');
	return camera;
}

let cleanup: (() => void) | null = null;

beforeEach(() => {
	harness.tasks.length = 0;
	harness.starts.length = 0;
});

afterEach(() => {
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
});

async function mountProbe(visitor: VisitorRuntimeState): Promise<HTMLElement> {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(VisitorRuntimeProbe, { target, props: { visitor } });
	cleanup = () => unmount(component);
	await tick();
	return target;
}

async function mountDirector(
	visitor: VisitorRuntimeState,
	onCameraGap?: (message: string | null) => void,
	navigationGraph: NavigationGraph = graph()
): Promise<void> {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(VisitorCameraDirector, {
		target,
		props: { graph: navigationGraph, visitor, onCameraGap }
	});
	cleanup = () => unmount(component);
	await tick();
}

async function frame(delta = 1 / 60): Promise<void> {
	for (const task of harness.tasks) task(delta);
	await tick();
}

describe('mounted visitor Camera handoff', () => {
	it('renders runtime progress, proving the interpreter state is reactive', async () => {
		const visitor = runtime();
		visitor.enter();
		const target = await mountProbe(visitor);
		expect(target.querySelector('[data-testid="view"]')?.textContent).toBe('view-1');

		visitor.continue();
		await tick();
		expect(target.querySelector('[data-testid="view"]')?.textContent).toBe('view-2');
		expect(target.querySelector('[data-testid="phase"]')?.textContent).toBe('holding');

		// A Stop-free selection is reactive too, and a real arrival replaces it.
		visitor.selectPresentation('presentation-guide-free');
		await tick();
		expect(target.querySelector('[data-testid="selected"]')?.textContent).toBe('presentation-guide-free');
		visitor.navigate('stop-2');
		await tick();
		expect(target.querySelector('[data-testid="selected"]')?.textContent).toBe('presentation-2');
	});

	it('does not restart an in-flight Travel when hold ticks change interpreter state', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		// First framing is a Cut; no motion yet.
		expect(harness.starts).toHaveLength(0);

		visitor.continue();
		await tick();
		expect(harness.starts).toHaveLength(1);
		const route = harness.starts[0] as { edges?: Array<{ connectionId?: string; direction?: string }> };
		expect(route.edges?.[0]).toEqual(
			expect.objectContaining({ connectionId: 'connection-2', direction: 'forward' })
		);

		// The destination holds for one second while the authored motion runs for
		// five. Each tick replaces the interpreter state; the effect must not
		// restart the same Travel from the current mid-flight pose.
		for (let index = 0; index < 10; index += 1) await frame();
		expect(visitor.state.holdRemainingMs).toBeLessThan(1000);
		expect(harness.starts).toHaveLength(1);
		// The Camera is already moving toward the destination, so the motion is not
		// pinned at the origin by a per-frame restart.
		const midFlight = mockCamera().lastPoint;
		expect(midFlight.x).toBeGreaterThan(0);
		expect(midFlight.x).toBeLessThan(4);

		// Finish the hold (auto-Continue advances the run) and keep framing. The
		// completion state change must not start a second motion either.
		for (let index = 0; index < 60; index += 1) await frame();
		expect(visitor.state.phase).toBe('completed');
		expect(harness.starts).toHaveLength(1);

		// The authored motion is five seconds. Let it finish; the sampled Camera
		// pose reaches the destination node rather than being pinned at the origin.
		for (let index = 0; index < 260; index += 1) await frame();
		const finished = mockCamera().lastPoint;
		expect(finished.x).toBeCloseTo(4, 5);
		expect(finished.y).toBeCloseTo(1.6, 5);
		expect(finished.z).toBeCloseTo(0, 5);
	});

	it('settles an explicit Cut to the in-flight destination immediately', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		visitor.continue();
		await tick();
		expect(harness.starts).toHaveLength(1);
		for (let index = 0; index < 10; index += 1) await frame();
		const midFlight = mockCamera().lastPoint;
		expect(midFlight.x).toBeGreaterThan(0);
		expect(midFlight.x).toBeLessThan(4);

		// A Stop-free selection of the same Presentation is an explicit Cut to the
		// View the Camera is already travelling to. It must settle now rather than
		// be mistaken for a duplicate hold-tick and let the five-second Travel run.
		visitor.selectPresentation('presentation-2');
		await tick();
		await frame(0);
		const settled = mockCamera().lastPoint;
		expect(settled.x).toBeCloseTo(4, 5);
		expect(settled.y).toBeCloseTo(1.6, 5);
		// The in-flight motion was ended, not replaced with a second route.
		expect(harness.starts).toHaveLength(1);
	});

	it('snaps an in-flight Travel to its destination when reduced motion turns on', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		visitor.continue();
		await tick();
		for (let index = 0; index < 10; index += 1) await frame();
		expect(mockCamera().lastPoint.x).toBeLessThan(4);

		// The host sets this from `prefers-reduced-motion`; an in-flight Travel must
		// stop animating at the moment the preference applies.
		visitor.reducedMotion = true;
		await tick();
		await frame(0);
		expect(mockCamera().lastPoint.x).toBeCloseTo(4, 5);
		expect(harness.starts).toHaveLength(1);
	});

	it('realizes the next authored Travel as a declared handoff when a hold expires mid-flight', async () => {
		const THREE_NODES: NavigationNodeData[] = [
			{
				id: 'view-a',
				label: 'Entrance',
				position: [0, 1.6, 0],
				cameraTarget: [0, 1.6, -1],
				fov: 54,
				connectedNodeIds: ['view-b']
			},
			{
				id: 'view-b',
				label: 'Gallery',
				position: [4, 1.6, 0],
				cameraTarget: [4, 1.6, -1],
				fov: 54,
				connectedNodeIds: ['view-a', 'view-c']
			},
			{
				id: 'view-c',
				label: 'Study',
				position: [8, 1.6, 0],
				cameraTarget: [8, 1.6, -1],
				fov: 54,
				connectedNodeIds: ['view-b']
			}
		];
		const authored = (id: string, from: string, to: string, start: number, end: number, durationSeconds: number) => ({
			id,
			fromNodeId: from,
			toNodeId: to,
			positionPath: {
				kind: 'rounded-polyline' as const,
				anchors: [
					{ id: `${id}-start`, position: [start, 1.6, 0] as [number, number, number] },
					{ id: `${id}-end`, position: [end, 1.6, 0] as [number, number, number] }
				]
			},
			clearance: 1.2,
			timing: { forward: { durationSeconds } }
		});
		const navigation: NavigationGraph = {
			navigationNodes: THREE_NODES,
			connections: [
				authored('connection-ab', 'view-a', 'view-b', 0, 4, 5),
				authored('connection-bc', 'view-b', 'view-c', 4, 8, 2)
			],
			nodeById: new Map(THREE_NODES.map((node) => [node.id, node]))
		};
		const threeStops = program({
			entryStopId: 'stop-a',
			presentations: [
				{ id: 'presentation-a', label: 'Entrance', viewIds: ['view-a'], defaultViewId: 'view-a', content: [] },
				{ id: 'presentation-b', label: 'Gallery', viewIds: ['view-b'], defaultViewId: 'view-b', content: [] },
				{ id: 'presentation-c', label: 'Study', viewIds: ['view-c'], defaultViewId: 'view-c', content: [] }
			],
			stops: [
				{
					id: 'stop-a',
					presentationId: 'presentation-a',
					viewId: 'view-a',
					invocation: { kind: 'cut', viewId: 'view-a' },
					holdSeconds: null,
					continuation: { kind: 'sequence-next' }
				},
				{
					id: 'stop-b',
					presentationId: 'presentation-b',
					viewId: 'view-b',
					invocation: { kind: 'travel', connectionId: 'connection-ab' },
					// Editorial time, not Camera arrival: this expires while the five-second
					// Travel to B is still in flight.
					holdSeconds: 0.5,
					continuation: { kind: 'sequence-next' }
				},
				{
					id: 'stop-c',
					presentationId: 'presentation-c',
					viewId: 'view-c',
					invocation: { kind: 'travel', connectionId: 'connection-bc' },
					holdSeconds: null,
					continuation: { kind: 'end' }
				}
			]
		});
		const visitor = createVisitorRuntimeState({ program: threeStops, options: OPTIONS });
		const gaps: (string | null)[] = [];
		visitor.enter();
		await mountDirector(visitor, (message) => gaps.push(message), navigation);

		visitor.continue();
		await tick();
		expect(harness.starts).toHaveLength(1);

		// 40 frames (≈0.67 s): B's 0.5 s hold expires while the 5 s A→B Travel is
		// still short of B, so the Experience advances to C first.
		for (let index = 0; index < 40; index += 1) await frame();
		expect(visitor.currentViewId).toBe('view-c');
		expect(visitor.state.stopId).toBe('stop-c');
		expect(gaps.filter((message) => message !== null)).toEqual([]);

		// The B→C connection is realized exactly, as a handoff from the live
		// A→B pose. The unfinished Travel is not restarted or finished first.
		expect(harness.starts).toHaveLength(2);
		const handoff = harness.starts[1] as { edges?: Array<{ connectionId?: string; direction?: string }> };
		expect(handoff.edges?.[0]).toEqual(
			expect.objectContaining({ connectionId: 'connection-bc', direction: 'forward' })
		);
		const handoffPose = mockCamera().lastPoint;
		expect(handoffPose.x).toBeGreaterThan(0);
		expect(handoffPose.x).toBeLessThan(4);

		// The two-second authored motion finishes at C.
		for (let index = 0; index < 200; index += 1) await frame();
		const finished = mockCamera().lastPoint;
		expect(finished.x).toBeCloseTo(8, 5);
		expect(finished.y).toBeCloseTo(1.6, 5);
		expect(finished.z).toBeCloseTo(0, 5);
	});

	it('accepts a declared Travel back to the settled View when it overtakes an in-flight one', async () => {
		// Two Stops share the same connection in opposite directions: A→B with a
		// short B hold, then B→A. The second Travel's destination equals the View
		// the Camera last settled on, but the A→B motion is still in flight, so it
		// is a new authored Travel, not a duplicate hold tick.
		const visitor = createVisitorRuntimeState({
			program: program({
				presentations: [
					{ id: 'presentation-1', label: 'Entrance', viewIds: ['view-1'], defaultViewId: 'view-1', content: [] },
					{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], defaultViewId: 'view-2', content: [] }
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
						invocation: { kind: 'travel', connectionId: 'connection-1' },
						holdSeconds: 0.5,
						continuation: { kind: 'sequence-next' }
					},
					{
						id: 'stop-3',
						presentationId: 'presentation-1',
						viewId: 'view-1',
						invocation: { kind: 'travel', connectionId: 'connection-1' },
						holdSeconds: null,
						continuation: { kind: 'end' }
					}
				]
			}),
			options: OPTIONS
		});
		const gaps: (string | null)[] = [];
		visitor.enter();
		await mountDirector(visitor, (message) => gaps.push(message));

		visitor.continue();
		await tick();
		for (let index = 0; index < 40; index += 1) await frame();
		expect(visitor.currentViewId).toBe('view-1');
		expect(visitor.state.stopId).toBe('stop-3');
		expect(gaps.filter((message) => message !== null)).toEqual([]);

		expect(harness.starts).toHaveLength(2);
		const handoff = harness.starts[1] as { edges?: Array<{ connectionId?: string; direction?: string }> };
		expect(handoff.edges?.[0]).toEqual(
			expect.objectContaining({ connectionId: 'connection-1', direction: 'reverse' })
		);
		const handoffPose = mockCamera().lastPoint;
		expect(handoffPose.x).toBeGreaterThan(0);
		expect(handoffPose.x).toBeLessThan(4);

		// The reverse motion is five seconds; let it finish at the origin View.
		for (let index = 0; index < 360; index += 1) await frame();
		const finished = mockCamera().lastPoint;
		expect(finished.x).toBeCloseTo(0, 5);
		expect(finished.y).toBeCloseTo(1.6, 5);
		expect(finished.z).toBeCloseTo(0, 5);
	});

	it('cancels an in-flight Travel when an explicit Cut returns to the origin View', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		visitor.continue();
		await tick();
		for (let index = 0; index < 10; index += 1) await frame();
		expect(mockCamera().lastPoint.x).toBeGreaterThan(0);

		// The Cut target equals the View the Camera left, so the settled-at-target
		// early return must not swallow it while motion is still in flight.
		visitor.selectPresentation('presentation-1');
		await tick();
		await frame(0);
		const settled = mockCamera().lastPoint;
		expect(settled.x).toBeCloseTo(0, 5);
		expect(settled.z).toBeCloseTo(0, 5);
	});
});
