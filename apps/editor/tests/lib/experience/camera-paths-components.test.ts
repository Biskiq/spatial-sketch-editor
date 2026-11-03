// @vitest-environment jsdom
/**
 * R217.S29 — the Stage path overlay's gestures.
 *
 * The overlay is the only place a point is added or dragged, and each gesture must
 * reach the controller exactly once: one accepted write per add and per drag, never a
 * write on cancellation. A press is also a Stage lease and a pointer capture, so it
 * must release both when the Guide hides, when the selected occurrence or connection
 * changes, when capture cannot be acquired, and when the overlay unmounts.
 *
 * No Stage and no route: the fake homes expose the live selected path as Svelte state,
 * and the projected evaluation is the same Camera evaluation the Stage supplies.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import {
	createViewportCameraState,
	evaluateViewport,
	projectWorld,
	type Vec3,
	type ViewportEvaluation
} from '@portfolio/camera-core';
import ExperiencePaths from '$lib/authoring/experience/ExperiencePaths.svelte';
import ExperienceHomesProbe from './fixtures/ExperienceHomesProbe.svelte';
import {
	createPathsHomes,
	pathRead,
	PATH_ANCHOR,
	PATH_SAMPLES
} from './fixtures/paths-homes.svelte';

function planEvaluation(): ViewportEvaluation {
	const state = createViewportCameraState({
		outputId: 'paths',
		sessionEpoch: 'paths',
		sourceRevision: 'paths',
		pose: {
			target: [0, 1, 0],
			azimuthRadians: 0,
			elevationRadians: Math.PI / 2,
			targetPlaneHeightMeters: 12
		},
		sceneRadiusMeters: 50,
		reading: 'plan'
	});
	const evaluated = evaluateViewport(
		state,
		{ left: 0, top: 0, width: 800, height: 600, devicePixelRatio: 1 },
		0,
		1
	);
	if (evaluated.kind !== 'evaluated') throw new Error(evaluated.reason);
	return evaluated.evaluation;
}

const EVALUATION = planEvaluation();
const DRAGGED_POINT: Vec3 = [1, 1.5, 0];

function cssOf(point: Vec3): [number, number] {
	const projected = projectWorld(point, EVALUATION, EVALUATION.token);
	if (projected.kind !== 'projected' || projected.visibility !== 'visible') {
		throw new Error(`point ${String(point)} is not visible`);
	}
	return [projected.css[0], projected.css[1]];
}

// jsdom has no pointer capture. The overlay must own and release it, so the tests
// install the same four methods a browser element has and count the release.
const releaseCapture = vi.fn();
const originalCapture = {
	setPointerCapture: Object.getOwnPropertyDescriptor(Element.prototype, 'setPointerCapture'),
	hasPointerCapture: Object.getOwnPropertyDescriptor(Element.prototype, 'hasPointerCapture'),
	releasePointerCapture: Object.getOwnPropertyDescriptor(Element.prototype, 'releasePointerCapture')
};

function installCapture(options: { set?: () => void } = {}): void {
	Object.defineProperty(Element.prototype, 'setPointerCapture', {
		configurable: true,
		writable: true,
		value: options.set ?? vi.fn()
	});
	Object.defineProperty(Element.prototype, 'hasPointerCapture', {
		configurable: true,
		writable: true,
		value: vi.fn(() => true)
	});
	Object.defineProperty(Element.prototype, 'releasePointerCapture', {
		configurable: true,
		writable: true,
		value: releaseCapture
	});
}

function restoreCapture(): void {
	for (const [name, descriptor] of Object.entries(originalCapture)) {
		if (descriptor === undefined) {
			delete (Element.prototype as unknown as Record<string, unknown>)[name];
		} else {
			Object.defineProperty(Element.prototype, name, descriptor);
		}
	}
}

function pointer(type: string, init: { x?: number; y?: number; id?: number } = {}): MouseEvent {
	const event = new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		button: 0,
		clientX: init.x ?? 0,
		clientY: init.y ?? 0
	});
	Object.defineProperty(event, 'pointerId', { value: init.id ?? 1 });
	return event;
}

type Live = {
	readonly instance: ReturnType<typeof mount>;
	readonly target: SVGSVGElement;
	alive: boolean;
};
const live: Live[] = [];

function mountOverlay(
	homes: ReturnType<typeof createPathsHomes>,
	options: {
		readonly onPlanePoint?: () => Vec3 | null;
		readonly beginLease?: () => boolean;
		readonly endLease?: () => void;
	} = {}
): Live {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	document.body.append(svg);
	const instance = mount(ExperienceHomesProbe, {
		target: svg,
		props: {
			homes: homes.homes,
			home: ExperiencePaths,
			homeProps: {
				evaluation: EVALUATION,
				onPlanePoint: options.onPlanePoint ?? (() => DRAGGED_POINT),
				beginLease: options.beginLease ?? (() => true),
				endLease: options.endLease
			}
		}
	});
	const entry: Live = { instance, target: svg, alive: true };
	live.push(entry);
	return entry;
}

function dispose(entry: Live): void {
	if (!entry.alive) return;
	entry.alive = false;
	void unmount(entry.instance);
	entry.target.remove();
}

async function settle(): Promise<void> {
	await tick();
	await tick();
}

function anchorHit(entry: Live): SVGCircleElement {
	const hit = entry.target.querySelector<SVGCircleElement>('.anchor-hit');
	if (hit === null) throw new Error('no path point is projected');
	return hit;
}

beforeEach(() => {
	releaseCapture.mockClear();
	installCapture();
});

afterEach(() => {
	for (const entry of live.splice(0)) dispose(entry);
	restoreCapture();
});

describe('R217.S29 — one path write per gesture', () => {
	it('adds exactly one point for one armed click on the route', async () => {
		const homes = createPathsHomes(pathRead());
		const entry = mountOverlay(homes);
		await settle();

		const route = entry.target.querySelector<SVGPolylineElement>('.route-hit');
		if (route === null) throw new Error('no armed route rendered');
		const [x, y] = cssOf(PATH_SAMPLES[2]!);
		route.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y })
		);

		expect(homes.addPathAnchor).toHaveBeenCalledTimes(1);
		expect(homes.addPathAnchor).toHaveBeenCalledWith(PATH_SAMPLES[2]);
	});

	it('commits one move for one drag, makes no change on Escape, then drags afresh', async () => {
		const endLease = vi.fn();
		const homes = createPathsHomes(pathRead());
		const entry = mountOverlay(homes, { endLease });
		await settle();
		const hit = anchorHit(entry);

		hit.dispatchEvent(pointer('pointerdown'));
		hit.dispatchEvent(pointer('pointermove', { x: 40, y: 30 }));
		await settle();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();

		expect(homes.movePathAnchor).not.toHaveBeenCalled();
		expect(endLease).toHaveBeenCalledTimes(1);
		expect(releaseCapture).toHaveBeenCalledTimes(1);

		// A cancelled press leaves no captured writer: the next press is a fresh drag.
		hit.dispatchEvent(pointer('pointerdown', { id: 2 }));
		hit.dispatchEvent(pointer('pointermove', { id: 2, x: 44, y: 34 }));
		hit.dispatchEvent(pointer('pointerup', { id: 2, x: 44, y: 34 }));
		await settle();

		expect(homes.movePathAnchor).toHaveBeenCalledTimes(1);
		expect(homes.movePathAnchor).toHaveBeenCalledWith(PATH_ANCHOR.id, DRAGGED_POINT);
		expect(endLease).toHaveBeenCalledTimes(2);
	});

	it('refuses the drag and releases the lease when capture cannot be acquired', async () => {
		installCapture({
			set: () => {
				throw new Error('capture refused');
			}
		});
		const endLease = vi.fn();
		const homes = createPathsHomes(pathRead());
		const entry = mountOverlay(homes, { endLease });
		await settle();
		const hit = anchorHit(entry);

		hit.dispatchEvent(pointer('pointerdown'));
		hit.dispatchEvent(pointer('pointermove', { x: 40, y: 30 }));
		hit.dispatchEvent(pointer('pointerup', { x: 40, y: 30 }));
		await settle();

		expect(endLease).toHaveBeenCalledTimes(1);
		expect(releaseCapture).not.toHaveBeenCalled();
		expect(homes.movePathAnchor).not.toHaveBeenCalled();
	});
});

describe('R217.S29 — a press is released when its surface goes away', () => {
	it('cancels on a selected connection change, on Guide hide, and on unmount', async () => {
		const endLease = vi.fn();
		const homes = createPathsHomes(pathRead());
		const entry = mountOverlay(homes, { endLease });
		await settle();

		const first = anchorHit(entry);
		first.dispatchEvent(pointer('pointerdown'));
		first.dispatchEvent(pointer('pointermove'));
		homes.setSelectedPath(pathRead({ connectionId: 'connection-2' }));
		await settle();
		expect(homes.movePathAnchor).not.toHaveBeenCalled();
		expect(endLease).toHaveBeenCalledTimes(1);
		expect(releaseCapture).toHaveBeenCalledTimes(1);

		const second = anchorHit(entry);
		second.dispatchEvent(pointer('pointerdown', { id: 2 }));
		second.dispatchEvent(pointer('pointermove', { id: 2 }));
		homes.setGuideOpen(false);
		await settle();
		expect(endLease).toHaveBeenCalledTimes(2);
		expect(homes.movePathAnchor).not.toHaveBeenCalled();

		homes.setGuideOpen(true);
		await settle();
		const third = anchorHit(entry);
		third.dispatchEvent(pointer('pointerdown', { id: 3 }));
		third.dispatchEvent(pointer('pointermove', { id: 3 }));
		await settle();
		dispose(entry);
		await settle();

		expect(endLease).toHaveBeenCalledTimes(3);
		expect(homes.movePathAnchor).not.toHaveBeenCalled();
	});
});
