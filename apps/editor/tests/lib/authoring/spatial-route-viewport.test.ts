// @vitest-environment jsdom
/**
 * E3 — the mounted Stage's viewport contract.
 *
 * The Stage's animation frame is a *refresh* of the one evaluation, not a
 * demand for a new image. These tests mount the real spatial route and drive
 * the production `requestAnimationFrame` loop through a manual frame queue, so
 * the counts below are the route's own work:
 *
 * 1. a settled Stage, in Plan and in 3D, produces zero Camera evaluations over
 *    120 ticks and keeps the same evaluation object;
 * 2. a pan step, a resize and a reading change each produce exactly one new
 *    evaluation, then settle again;
 * 3. the route never leaves more than one frame queued, and teardown leaves
 *    none.
 *
 * `camera:evaluate` is the E0 production counter, read through
 * `startStageCounting`; no test calls the counter itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
const harness = vi.hoisted(() => ({ document: null as unknown, facade: null as unknown }));
vi.mock('$lib/authoring/stage/stage-facade', async (original) => {
	const actual = await original<typeof import('$lib/authoring/stage/stage-facade')>();
	return {
		...actual,
		createStageFacade: (...args: Parameters<typeof actual.createStageFacade>) => {
			const facade = actual.createStageFacade(...args);
			harness.facade = facade;
			return facade;
		}
	};
});
vi.mock('$lib/authoring/stage/shell/EditorHead.svelte', async () => ({
	default: (await import('./fixtures/HeadProbe.svelte')).default
}));
vi.mock('$lib/authoring/stage/shell/StageCanvas.svelte', async () => ({
	default: (await import('./fixtures/StageCanvasBoundsProbe.svelte')).default
}));
vi.mock('$lib/platform/project-persistence', async (original) => {
	const actual = await original<typeof import('$lib/platform/project-persistence')>();
	return {
		...actual,
		createProjectAuth: () => ({
			getSession: async () => ({ authenticated: false }),
			signIn() {},
			async signOut() {}
		}),
		createProjectApi: () => ({
			async loadProject() {
				return {
					document: harness.document,
					savedBaseToken: 'base',
					savedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
					savedSourceContentId: 'content-1'
				};
			}
		})
	};
});
import { flushSync, mount, tick, unmount } from 'svelte';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { startStageCounting, type StageCounting } from '../../helpers/stage-counts';
import { canvasBoundsProbe } from './fixtures/StageCanvasBoundsProbe.svelte';
import Page from '../../../src/routes/project/[projectId]/spatial/+page.svelte';

const RECT = {
	left: 352,
	top: 73,
	width: 928,
	height: 720,
	right: 1280,
	bottom: 793,
	x: 352,
	y: 73,
	toJSON() {}
};

let component: ReturnType<typeof mount>;
let target: HTMLElement;
let mounted = false;
let frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let counting: StageCounting;
const stageWidth = { value: RECT.width };
const facade = () => harness.facade as StageFacade;

/** Advance one display frame through the production rAF callbacks. */
async function frame(count = 1): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await tick();
		const pending = [...frames.values()];
		frames.clear();
		for (const callback of pending) callback(performance.now());
	}
	await tick();
}

/** Let route activation, adapter binding and the first evaluation land. */
async function settle(): Promise<void> {
	for (let index = 0; index < 12; index += 1) {
		await frame();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function button(text: string): HTMLButtonElement {
	const found = [...target.querySelectorAll('button')].find(
		(node) =>
			(node.getAttribute('aria-label') ?? node.textContent ?? '')
				.replace(/\s+/g, '')
				.toLowerCase() === text.replace(/\s+/g, '').toLowerCase()
	);
	if (found === undefined) throw new Error(`Missing button ${text}`);
	return found;
}

function key(value: string): void {
	window.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
}

beforeEach(async () => {
	vi.clearAllMocks();
	try {
		globalThis.localStorage?.clear();
	} catch {
		// A runtime without web storage cannot have persisted a preference.
	}
	frames = new Map();
	frameId = 0;
	stageWidth.value = RECT.width;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		frames.set(++frameId, callback);
		return frameId;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames.delete(id);
	});
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('prefers-reduced-motion'),
		addEventListener() {},
		removeEventListener() {}
	}));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT as DOMRect);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => stageWidth.value);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(RECT.height);
	counting = startStageCounting();
	harness.document = await createUnitProject({
		id: 'project-1',
		name: 'Mounted viewport',
		layout: buildStarterEnclosureLayout()
	});
	target = document.createElement('div');
	document.body.append(target);
	component = mount(Page, { target });
	mounted = true;
	await vi.waitFor(() => expect(target.querySelector('[data-testid="stage-canvas"]')).not.toBeNull());
	await settle();
	expect(facade()).toBeDefined();
	expect(facade().evaluation()).not.toBeNull();
});

afterEach(() => {
	if (mounted) unmount(component);
	mounted = false;
	target.remove();
	counting.stop();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('mounted Stage viewport rest', () => {
	it('evaluates zero times over 120 ticks in 3D and in Plan', async () => {
		expect(facade().evaluation()?.settledReading).toBe('3d');
		const threeD = facade().evaluation();
		counting.reset();
		await frame(120);
		expect(counting.count('camera:evaluate')).toBe(0);
		expect(facade().evaluation()).toBe(threeD);

		button('Plan').click();
		flushSync();
		await settle();
		expect(facade().evaluation()?.settledReading).toBe('plan');
		const plan = facade().evaluation();
		counting.reset();
		await frame(120);
		expect(counting.count('camera:evaluate')).toBe(0);
		expect(facade().evaluation()).toBe(plan);
	});

	it('evaluates once for a pan step and for a resize, then settles again', async () => {
		button('Plan').click();
		flushSync();
		await settle();
		expect(facade().evaluation()?.settledReading).toBe('plan');
		const plan = facade().evaluation();

		counting.reset();
		key('ArrowRight');
		await frame(1);
		expect(counting.count('camera:evaluate')).toBe(1);
		const panned = facade().evaluation();
		expect(panned).not.toBe(plan);
		expect(facade().camera.state().pose.target).not.toEqual(plan?.target);
		counting.reset();
		await frame(120);
		expect(counting.count('camera:evaluate')).toBe(0);
		expect(facade().evaluation()).toBe(panned);

		counting.reset();
		stageWidth.value = RECT.width - 120;
		await frame(1);
		expect(counting.count('camera:evaluate')).toBe(1);
		const resized = facade().evaluation();
		expect(resized).not.toBe(panned);
		expect(resized?.rect.width).toBe(RECT.width - 120);
		counting.reset();
		await frame(120);
		expect(counting.count('camera:evaluate')).toBe(0);
		expect(facade().evaluation()).toBe(resized);
	});

	it('keeps exactly one frame queued while mounted and none after teardown', async () => {
		expect(frames.size).toBe(1);
		await frame(1);
		expect(frames.size).toBe(1);
		await unmount(component);
		mounted = false;
		expect(frames.size).toBe(0);
	});
});

it('refreshes Canvas bounds without replaying the Scene source or Layout root registration', async () => {
	const { readBounds, setSource, registerLayoutIdentity, refresh } = canvasBoundsProbe;
	expect(setSource).toHaveBeenCalledTimes(1);
	expect(registerLayoutIdentity).toHaveBeenCalledTimes(1);
	const originalBounds = readBounds.mock.lastCall?.[0];
	expect(originalBounds).toEqual(expect.objectContaining({ minX: expect.any(Number) }));
	expect(refresh).not.toBeNull();

	const reads = readBounds.mock.calls.length;
	for (let index = 1; index <= 2; index += 1) {
		refresh!();
		await frame();
		expect(readBounds).toHaveBeenCalledTimes(reads + index);
		expect(readBounds.mock.lastCall?.[0]).toEqual(originalBounds);
		expect(setSource).toHaveBeenCalledTimes(1);
		expect(registerLayoutIdentity).toHaveBeenCalledTimes(1);
	}
});
