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
 * 4. One Guide clock (guide-playback plan, slice 4): every surface is
 *    time-aligned. A stay never counts during its arrival Travel — the director
 *    confirms the arrival when the Travel lands — so the retired public
 *    overtake (a hold expiring mid-flight) cannot happen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
	tasks: [] as Array<{ readonly run: (delta: number) => void; readonly running: () => boolean }>,
	starts: [] as unknown[]
}));

vi.mock('@threlte/core', async () => {
	const { default: PerspectiveCamera } = await import('./fixtures/MockPerspectiveCamera.svelte');
	return {
		T: { PerspectiveCamera },
		useTask: (callback: (delta: number) => void, options?: { running?: () => boolean }) => {
			// Threlte runs a task only while its `running` option holds; the mock keeps
			// that gate so a test can prove an inactive director is never ticked.
			harness.tasks.push({ run: callback, running: options?.running ?? (() => true) });
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
import { guideTimeMapForProgram } from '$lib/visitor/guide-run-map';
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
 * Two authored Stops in Automatic pacing. The second is reached by an explicit
 * Travel on `connection-2` (five seconds), then stays one second.
 */
function program(overrides: Partial<ExecutionProgram> = {}): ExecutionProgram {
	return {
		kind: 'execution-program',
		formatVersion: 4,
		capabilities: [],
		welcome: null,
		experienceId: 'experience-director',
		entryStopId: 'stop-1',
		pacing: 'automatic',
		presentations: [
			{
				id: 'presentation-1',
				label: 'Entrance',
				viewIds: ['view-1', 'view-2'],
				steps: [{ kind: 'travel', connectionId: 'connection-1' }],
				explorable: true,
				content: []
			},
			{ id: 'presentation-2', label: 'Gallery', viewIds: ['view-2'], steps: [], explorable: true, content: [] },
			{ id: 'presentation-guide-free', label: 'Study', viewIds: ['view-1'], steps: [], explorable: true, content: [] }
		],
		stops: [
			{
				id: 'stop-1',
				presentationId: 'presentation-1',
				entryViewId: 'view-1',
				staySeconds: 30,
				invitation: null,
				invocation: { kind: 'cut', viewId: 'view-1' },
				continuation: { kind: 'sequence-next' },
			},
			{
				id: 'stop-2',
				presentationId: 'presentation-2',
				entryViewId: 'view-2',
				staySeconds: 1,
				invitation: null,
				invocation: { kind: 'travel', connectionId: 'connection-2' },
				continuation: { kind: 'sequence-next' },
			}
		],
		state: [],
		localTime: [
			{ stopId: 'stop-1', staySeconds: 30 },
			{ stopId: 'stop-2', staySeconds: 1 }
		],
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
	navigationGraph: NavigationGraph = graph(),
	active = true,
	options: {
		readonly guidedInputEnabled?: boolean;
		readonly viewOverride?: string | null;
		readonly onCommand?: (command: string) => void;
	} = {}
): Promise<void> {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(VisitorCameraDirector, {
		target,
		props: { graph: navigationGraph, visitor, onCameraGap, active, ...options }
	});
	cleanup = () => unmount(component);
	await tick();
}

async function frame(delta = 1 / 60): Promise<void> {
	for (const task of harness.tasks) if (task.running()) task.run(delta);
	await tick();
}

describe('mounted visitor Camera handoff', () => {
	it('seeks a paused Travel through Camera, rewinds a stay, and plays from the sought position', async () => {
		const transitions = [{ fromStopId: 'stop-1', toStopId: 'stop-2', invocation: { kind: 'travel' as const, connectionId: 'connection-2' } }];
		const visitor = createVisitorRuntimeState({ program: program(), options: { ...OPTIONS, transitions } });
		visitor.enter(); visitor.pause();
		await mountDirector(visitor);
		expect(mockCamera().lastPoint.y).toBe(1.6);
		const derived = guideTimeMapForProgram({ program: visitor.program, transitions, graph: graph() });
		if (derived.kind !== 'ready') throw Error('map not ready');
		const travel = derived.map.segments.find((segment) => segment.kind === 'travel')!;
		const firstStay = derived.map.segments.find((segment) => segment.kind === 'hold')!;
		expect(visitor.seek(derived.map, { segmentId: travel.id, elapsedSeconds: 2.5 })).toBe(true);
		await tick();
		expect(visitor.state).toMatchObject({ stopId: 'stop-2', phase: 'traveling', paused: true, holdRemainingMs: null });
		const midpoint = mockCamera().lastPoint;
		expect(midpoint.x).toBeGreaterThan(0); expect(midpoint.x).toBeLessThan(4);
		await frame(1);
		expect(mockCamera().lastPoint).toEqual(midpoint);
		visitor.play(); await tick(); await frame(2.5);
		expect(visitor.state).toMatchObject({ stopId: 'stop-2', phase: 'holding', holdRemainingMs: 1000 });
		expect(visitor.seek(derived.map, { segmentId: firstStay.id, elapsedSeconds: 10 })).toBe(true);
		await tick();
		expect(visitor.state).toMatchObject({ stopId: 'stop-1', phase: 'holding', holdRemainingMs: 20000, paused: true });
		expect(mockCamera().lastPoint.x).toBe(0);
		visitor.play(); await tick(); await frame(1);
		expect(visitor.state.holdRemainingMs).toBe(19000);
	});


	it('seeks a Manual Travel without inventing a stay duration; Next lands at its wait', async () => {
		const transitions = [{ fromStopId: 'stop-1', toStopId: 'stop-2', invocation: { kind: 'travel' as const, connectionId: 'connection-2' } }];
		const manual = program({ pacing: 'manual', stops: program().stops.map((stop) => ({ ...stop, staySeconds: null })) });
		const visitor = createVisitorRuntimeState({ program: manual, options: { ...OPTIONS, transitions } });
		visitor.enter(); await mountDirector(visitor);
		const derived = guideTimeMapForProgram({ program: manual, transitions, graph: graph() });
		if (derived.kind !== 'ready') throw Error('map not ready');
		const travel = derived.map.segments.find((segment) => segment.kind === 'travel')!;
		expect(visitor.seek(derived.map, { segmentId: travel.id, elapsedSeconds: 2 })).toBe(true);
		await tick();
		const pose = mockCamera().lastPoint;
		await frame(1);
		expect(mockCamera().lastPoint).toEqual(pose);
		expect(visitor.state).toMatchObject({ phase: 'traveling', paused: true, holdRemainingMs: null });
		visitor.continue(); await tick(); await frame();
		expect(visitor.state).toMatchObject({ phase: 'ready', paused: false, holdRemainingMs: null });
	});

	it('renders runtime progress, proving the interpreter state is reactive', async () => {
		const visitor = runtime();
		visitor.enter();
		const target = await mountProbe(visitor);
		expect(target.querySelector('[data-testid="view"]')?.textContent).toBe('view-1');

		visitor.continue();
		await tick();
		expect(target.querySelector('[data-testid="view"]')?.textContent).toBe('view-2');
		expect(target.querySelector('[data-testid="phase"]')?.textContent).toBe('traveling');

		visitor.selectPresentation('presentation-guide-free');
		await tick();
		expect(target.querySelector('[data-testid="selected"]')?.textContent).toBe('presentation-guide-free');
		visitor.navigate('stop-2');
		await tick();
		expect(target.querySelector('[data-testid="selected"]')?.textContent).toBe('presentation-2');
	});

	it('plays the arrival Travel on its authored timing and starts the stay only when it lands', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		expect(harness.starts).toHaveLength(0);

		visitor.continue();
		await tick();
		expect(harness.starts).toHaveLength(1);
		const route = harness.starts[0] as { edges?: Array<{ connectionId?: string; direction?: string }> };
		expect(route.edges?.[0]).toEqual(expect.objectContaining({ connectionId: 'connection-2', direction: 'forward' }));

		// Two seconds into a five-second Travel: no stay has started, nothing restarts.
		for (let index = 0; index < 120; index += 1) await frame();
		expect(visitor.state).toMatchObject({ stopId: 'stop-2', phase: 'traveling', holdRemainingMs: null });
		expect(harness.starts).toHaveLength(1);
		const midFlight = mockCamera().lastPoint;
		expect(midFlight.x).toBeGreaterThan(0);
		expect(midFlight.x).toBeLessThan(4);

		// The Travel lands; the director confirms the arrival and the one-second stay runs.
		for (let index = 0; index < 190; index += 1) await frame();
		expect(visitor.state.phase).toBe('holding');
		expect(mockCamera().lastPoint.x).toBeCloseTo(4, 5);
		for (let index = 0; index < 70; index += 1) await frame();
		expect(visitor.state.phase).toBe('completed');
		expect(harness.starts).toHaveLength(1);
	});

	it('Next during the arrival Travel lands now with a Cut', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor, undefined, graph(), true, { guidedInputEnabled: true });
		visitor.continue();
		await tick();
		for (let index = 0; index < 30; index += 1) await frame();
		expect(mockCamera().lastPoint.x).toBeLessThan(4);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await tick();
		await frame(0);
		expect(mockCamera().lastPoint.x).toBeCloseTo(4, 5);
		expect(visitor.state).toMatchObject({ stopId: 'stop-2', phase: 'holding', holdRemainingMs: 1000 });
		expect(harness.starts).toHaveLength(1);
	});

	it('settles an explicit Cut to the in-flight destination immediately', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		visitor.continue();
		await tick();
		for (let index = 0; index < 10; index += 1) await frame();
		expect(mockCamera().lastPoint.x).toBeLessThan(4);
		visitor.selectPresentation('presentation-2');
		await tick();
		await frame(0);
		expect(mockCamera().lastPoint.x).toBeCloseTo(4, 5);
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
		visitor.reducedMotion = true;
		await tick();
		await frame(0);
		expect(mockCamera().lastPoint.x).toBeCloseTo(4, 5);
		expect(harness.starts).toHaveLength(1);
	});

	it('pause in run state freezes the Travel and the clock; play resumes both', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		visitor.continue();
		await tick();
		for (let index = 0; index < 30; index += 1) await frame();
		visitor.pause();
		await tick();
		const frozen = mockCamera().lastPoint.x;
		for (let index = 0; index < 120; index += 1) await frame();
		expect(mockCamera().lastPoint.x).toBe(frozen);
		expect(visitor.state.phase).toBe('traveling');
		visitor.play();
		await tick();
		for (let index = 0; index < 30; index += 1) await frame();
		expect(mockCamera().lastPoint.x).toBeGreaterThan(frozen);
	});

	it('an inactive director neither ticks a staying run nor moves the Camera', async () => {
		const visitor = runtime();
		visitor.enter();
		expect(visitor.state.phase).toBe('holding');
		await mountDirector(visitor, undefined, graph(), false);
		const before = visitor.state.holdRemainingMs;
		for (let index = 0; index < 60; index += 1) await frame();
		expect(visitor.state.holdRemainingMs).toBe(before);
		expect(harness.starts).toHaveLength(0);
		expect(harness.tasks.every((task) => task.running() === false)).toBe(true);
	});

	it('Explore freezes the stay, plays the authored step and Back restores it', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		for (let index = 0; index < 60; index += 1) await frame();
		const left = visitor.state.holdRemainingMs!;
		expect(visitor.explore()).toBe(true);
		await tick();
		for (let index = 0; index < 120; index += 1) await frame();
		expect(visitor.state.resume?.holdRemainingMs).toBe(left);
		expect(visitor.exploreStep(1)).toBe(true);
		await tick();
		expect(harness.starts).toHaveLength(1);
		expect((harness.starts[0] as { edges?: Array<{ connectionId?: string }> }).edges?.[0]?.connectionId).toBe('connection-1');
		visitor.resume();
		await tick();
		await frame(0);
		expect(mockCamera().lastPoint.x).toBeCloseTo(0, 5);
		expect(visitor.state).toMatchObject({ stopId: 'stop-1', phase: 'holding', holdRemainingMs: left });
	});

	it('routes the visitor keys: Next always, ← Prev, Space Pause, E Explore, and ← → B in Explore', async () => {
		const visitor = runtime();
		visitor.enter();
		const commands: string[] = [];
		await mountDirector(visitor, undefined, graph(), true, { guidedInputEnabled: true, onCommand: (command) => commands.push(command) });
		const press = async (key: string) => {
			window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			await tick();
		};
		await press('ArrowLeft');
		await press(' ');
		await press('e');
		expect(commands).toEqual(['previous', 'pause', 'explore']);
		// Next works during a stay.
		await press('Enter');
		expect(visitor.state.stopId).toBe('stop-2');
		visitor.explore();
		await tick();
		await press('ArrowLeft');
		await press('ArrowRight');
		await press('b');
		expect(commands.slice(3)).toEqual(['view-previous', 'view-next', 'back']);
	});

	it('an active director runs its task, and the default is active', async () => {
		const visitor = runtime();
		visitor.enter();
		await mountDirector(visitor);
		expect(harness.tasks.every((task) => task.running())).toBe(true);
	});
});
