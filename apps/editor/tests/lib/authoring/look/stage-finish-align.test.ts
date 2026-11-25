// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount, type ComponentProps } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import AppearanceWorldRegions from '$lib/authoring/look/AppearanceWorldRegions.svelte';
import StageFinishAlign from '$lib/authoring/stage/shell/StageFinishAlign.svelte';
import { floorChart } from '$lib/authoring/look/align-chart';

/** Plan at azimuth 0, 100 px per metre: x → right, −z → up. */
const planProject = (p: readonly [number, number, number]) => [100 + p[0] * 100, 500 + p[2] * 100] as const;

let mounted: ReturnType<typeof mount> | null = null;
afterEach(() => {
	if (mounted !== null) unmount(mounted);
	mounted = null;
	document.body.innerHTML = '';
});

function pointer(type: string, x: number, y: number): Event {
	const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
	Object.defineProperty(event, 'pointerId', { value: 1 });
	return event;
}

describe('Align gesture cancellation', () => {
	it.each(['pointercancel', 'lostpointercapture', 'blur', 'Escape', 'unmount', 'withdrawn contribution'])(
		'discards a preview on %s without committing',
		async (reason) => {
			const preview = vi.fn();
			const cancel = vi.fn();
			const commit = vi.fn();
			const props: ComponentProps<typeof StageFinishAlign> = {
				align: {
					target: { kind: 'surface', surface: { kind: 'room-floor', roomId: 'r' } },
					surface: 'floor',
					place: 'Floor',
					widthMeters: 4,
					heightMeters: 3,
					invoker: null,
					chart: floorChart({ floorY: 0, minX: 0, maxX: 4, minZ: 0, maxZ: 3 }),
					corners: [[0, 0, 0], [4, 0, 0], [4, 0, -3], [0, 0, -3]],
					toward: [0, 1, 0],
					occluders: []
				},
				project: planProject,
				source: { base: { catalogue: 'wood-oak-veneer' } },
				recipes: new Map(),
				onMaterialPreview: preview,
				onCancelPreview: cancel,
				onCommit: commit,
				onPutBack: vi.fn()
			};
			let align: typeof props | null = props;
			let invalidate: () => void;
			const subscribe = createSubscriber((update) => { invalidate = update; });
			mounted = reason === 'withdrawn contribution'
				? mount(AppearanceWorldRegions, {
					target: document.body,
					props: { get align() { subscribe(); return align; } }
				})
				: mount(StageFinishAlign, { target: document.body, props });
			await tick();
			const handle = document.querySelector('[data-align-handle-offset]')!;
			Object.defineProperty(handle, 'setPointerCapture', { value: vi.fn() });
			handle.dispatchEvent(pointer('pointerdown', 100, 100));
			handle.dispatchEvent(pointer('pointermove', 140, 100));
			expect(preview).toHaveBeenCalled();
			cancel.mockClear();
			if (reason === 'blur') window.dispatchEvent(new Event('blur'));
			else if (reason === 'Escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			else if (reason === 'unmount') { unmount(mounted); mounted = null; }
			else if (reason === 'withdrawn contribution') {
				align = null;
				invalidate!();
				await tick();
				expect(document.querySelector('[data-finish-align]')).toBeNull();
			} else handle.dispatchEvent(pointer(reason, 140, 100));
			handle.dispatchEvent(pointer('pointerup', 140, 100));
			expect(cancel).toHaveBeenCalled();
			expect(commit).not.toHaveBeenCalled();
		}
	);
});

describe('Align overlay placement', () => {
	it('draws the projected surface, a tile grid and a tile-corner handle; waits without a projection', async () => {
		const props = {
			align: {
				target: { kind: 'surface', surface: { kind: 'room-floor', roomId: 'r' } },
				surface: 'floor',
				place: 'Floor',
				widthMeters: 4,
				heightMeters: 3,
				invoker: null,
				chart: floorChart({ floorY: 0, minX: 0, maxX: 4, minZ: 0, maxZ: 3 }),
				corners: [],
				toward: [0, 1, 0],
				occluders: []
			},
			project: planProject,
			source: { base: { catalogue: 'wood-oak-veneer' } },
			recipes: new Map(),
			onMaterialPreview: vi.fn(),
			onCancelPreview: vi.fn(),
			onCommit: vi.fn(),
			onPutBack: vi.fn()
		} as never;
		mounted = mount(StageFinishAlign, { target: document.body, props });
		await tick();
		const grid = document.querySelector('[data-align-grid]')!;
		expect(grid.getAttribute('d')).toMatch(/^M/);
		const handle = document.querySelector('[data-align-handle-offset]')!;
		const x = Number(handle.getAttribute('x')) + 8;
		const y = Number(handle.getAttribute('y')) + 8;
		// Inside the projected floor (x 100…500, y 500…800).
		expect(x).toBeGreaterThanOrEqual(100);
		expect(x).toBeLessThanOrEqual(500);
		expect(y).toBeGreaterThanOrEqual(500);
		expect(y).toBeLessThanOrEqual(800);
		unmount(mounted);
		mounted = mount(StageFinishAlign, { target: document.body, props: { ...(props as object), project: null } as never });
		await tick();
		expect(document.querySelector('[data-align-unavailable]')?.textContent).toContain('Waiting for the faced view');
		expect(document.querySelector('[data-align-handle-offset]')).toBeNull();
	});
});
