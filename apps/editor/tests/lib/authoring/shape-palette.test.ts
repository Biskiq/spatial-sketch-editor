// @vitest-environment jsdom
/**
 * T5.P01.S02 — the Shape palette is a reader and caller, never a second writer.
 *
 * These pin the two field behaviours the review round found: the depth field
 * forwards its raw text (so the session can invalidate Create) and a hover
 * revision never rewrites text the creator is still typing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type {
	ShapeReadingSnapshot,
	ShapeReadingSurface
} from '$lib/authoring/adapters/scene/shape/reading';

const state = vi.hoisted(() => ({
	surface: null as ShapeReadingSurface | null,
	revision: 0
}));

vi.mock('$lib/authoring/adapters/scene/shape/reading', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/authoring/adapters/scene/shape/reading')>();
	return {
		...actual,
		shapeReadingSurface: () => state.surface,
		shapeReadingSurfaceRevision: () => state.revision
	};
});

import ShapeReadingPalette from '$lib/authoring/adapters/scene/shape/ShapeReadingPalette.svelte';

const snapshot = (overrides: Partial<ShapeReadingSnapshot> = {}): ShapeReadingSnapshot => ({
	kind: 'line',
	plane: 'plan',
	sheet: { x: 0, z: 0, yaw: 0 },
	phase: 'depth',
	points: 4,
	canFinish: true,
	canCreate: true,
	depthText: '1',
	depth: 1,
	flip: false,
	refusal: null,
	outlineSize: '2.000 × 2.000 m',
	facts: [],
	...overrides
});

function publish(next: ShapeReadingSnapshot): void {
	state.surface = { snapshot: () => next, controller: controller };
	state.revision += 1;
}

let cleanup: (() => void) | undefined;
let controller: ShapeReadingSurface['controller'];

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	state.surface = null;
	state.revision = 0;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

async function panel(initial: ShapeReadingSnapshot = snapshot()): Promise<HTMLElement> {
	controller = {
		setKind: vi.fn(),
		setPlane: vi.fn(),
		setSheet: vi.fn(),
		finish: vi.fn(),
		backtrack: vi.fn(),
		clear: vi.fn(),
		setDepth: vi.fn(),
		flip: vi.fn(),
		create: vi.fn()
	};
	publish(initial);
	// jsdom has no animation clock; the palette's one rAF loop still needs to run.
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
		setTimeout(() => callback(Date.now()), 0) as unknown as number
	);
	vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle));
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(ShapeReadingPalette, { target });
	cleanup = () => {
		void unmount(component);
	};
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 10));
	return target;
}

describe('T5.P01.S02 — Shape palette fields', () => {
	it('forwards blank depth text so the session can invalidate Create', async () => {
		const target = await panel();
		const input = target.querySelector<HTMLInputElement>('[data-shape-depth]')!;
		input.value = '';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		await tick();
		expect(controller.setDepth).toHaveBeenCalledWith('');

		// Create commits the field first: invalid text reaches the session before
		// any install can be attempted, and a valid new depth is what gets created.
		input.value = '2';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		target.querySelector<HTMLButtonElement>('[data-shape-create]')!.click();
		expect(controller.setDepth).toHaveBeenLastCalledWith('2');
		expect(vi.mocked(controller.setDepth).mock.invocationCallOrder[1]).toBeLessThan(
			vi.mocked(controller.create).mock.invocationCallOrder[0]!
		);
		expect(controller.create).toHaveBeenCalledTimes(1);
	});

	it('refuses a blank sheet field instead of committing zero', async () => {
		const target = await panel(snapshot({ plane: 'elevation' }));
		const x = target.querySelector<HTMLInputElement>('[data-shape-x]')!;
		x.value = '';
		x.dispatchEvent(new Event('input', { bubbles: true }));
		target.querySelector<HTMLButtonElement>('[data-shape-sheet-apply]')!.click();
		await tick();
		expect(controller.setSheet).not.toHaveBeenCalled();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('blank is not zero');
	});

	it('keeps text being typed across a hover-published revision', async () => {
		const target = await panel();
		const input = target.querySelector<HTMLInputElement>('[data-shape-depth]')!;
		input.value = '2.';
		input.dispatchEvent(new Event('input', { bubbles: true }));

		// The sheet did not change; only the revision did. A hover must not reset
		// the field to the accepted value.
		publish(snapshot({ sheet: { x: 0, z: 0, yaw: 0 } }));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(input.value).toBe('2.');
	});
});
