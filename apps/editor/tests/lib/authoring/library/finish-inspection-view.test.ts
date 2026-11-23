// @vitest-environment jsdom
/**
 * T2.S8 U5 Library inspection: one canvas stays mounted, the last valid frame
 * holds while the same material redraws, a new material (or the first open)
 * shows the neutral loading state, Studio and Grazing ask for the Library's own
 * rigs, and geometry and lighting are written back to session state. The fake
 * host answers only when told, so every render here is deliberately delayed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import FinishInspectionView from '$lib/authoring/library/FinishInspectionView.svelte';
import { FINISH_TILES_CONTEXT_KEY } from '$lib/authoring/look/finish-tiles-context';
import type { InspectionRequest, InspectionState } from '$lib/render/materials/inspection-host';
import { reactiveProps } from '../__fixtures__/reactive-props.svelte';

type Call = { request: InspectionRequest; onState: (state: InspectionState) => void; stopped: boolean };

const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
	for (const component of mounted.splice(0)) unmount(component);
	document.body.innerHTML = '';
});

const ready = { status: 'ready', frame: { width: 1, height: 1, pixels: new Uint8Array([0, 0, 0, 255]) } } as unknown as InspectionState;

function render(initial: Record<string, unknown> = {}) {
	const calls: Call[] = [];
	const tiles = {
		epoch: 0,
		// The refusal fallback's sample tile: never ready in this harness.
		leaseNow: () => null,
		lease: () => new Promise(() => {}),
		inspect(request: InspectionRequest, onState: (state: InspectionState) => void) {
			const call: Call = { request, onState, stopped: false };
			calls.push(call);
			return () => {
				call.stopped = true;
			};
		}
	};
	const onSettings = vi.fn();
	const props = reactiveProps({
		source: { kind: 'catalogue', id: 'wood-oak-veneer' },
		color: '#a08060',
		label: 'Oak',
		materialKey: 'curated:wood-oak-veneer',
		onSettings,
		...initial
	});
	const host = document.createElement('div');
	document.body.append(host);
	mounted.push(mount(FinishInspectionView, { target: host, props: props as never, context: new Map([[FINISH_TILES_CONTEXT_KEY, tiles]]) }));
	flushSync();
	const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
	const state = () => q('[data-library-inspect]')?.getAttribute('data-inspect-state');
	const last = () => calls[calls.length - 1]!;
	const answer = (call: Call = last()) => {
		call.onState(ready);
		flushSync();
	};
	return { host, q, state, calls, last, answer, props, onSettings };
}

describe('T2.S8 U5 Library inspection', () => {
	it('opens on a neutral loading state with the canvas mounted, then shows the frame', () => {
		const fx = render();
		expect(fx.state()).toBe('loading');
		expect(fx.q('[data-inspect-loading]')).not.toBeNull();
		expect(fx.q('[data-inspect-canvas]')?.classList.contains('hidden')).toBe(true);
		expect(fx.last().request.lighting).toBe('library-studio');
		fx.answer();
		expect(fx.state()).toBe('ready');
		expect(fx.q('[data-inspect-loading]')).toBeNull();
		expect(fx.q('[data-inspect-canvas]')?.classList.contains('hidden')).toBe(false);
	});

	it('holds the last frame through rapid geometry and lighting switches on the same material', () => {
		const fx = render();
		fx.answer();
		const canvas = fx.q('[data-inspect-canvas]');
		fx.q<HTMLButtonElement>('[data-inspect-geometry="plane"]')!.click();
		flushSync();
		fx.q<HTMLButtonElement>('[data-inspect-lighting="grazing"]')!.click();
		flushSync();
		fx.q<HTMLButtonElement>('[data-inspect-geometry="block"]')!.click();
		flushSync();
		// Every switch before an answer replaced the request; the frame held throughout.
		expect(fx.calls.slice(0, -1).every((call) => call.stopped)).toBe(true);
		expect(fx.state()).toBe('redrawing');
		expect(fx.q('[data-inspect-loading]')).toBeNull();
		expect(fx.q('[data-inspect-canvas]')).toBe(canvas);
		expect(canvas?.classList.contains('hidden')).toBe(false);
		expect(fx.last().request).toMatchObject({ geometry: 'block', lighting: 'library-grazing' });
		fx.answer();
		expect(fx.state()).toBe('ready');
		expect(fx.q('[data-inspect-canvas]')).toBe(canvas);
		expect(fx.onSettings).toHaveBeenLastCalledWith({ geometry: 'block', lighting: 'grazing' });
	});

	it('shows the loading state, not the old picture, when the material changes', () => {
		const fx = render();
		fx.answer();
		fx.props.source = { kind: 'catalogue', id: 'tile-ceramic-white' };
		fx.props.materialKey = 'curated:tile-ceramic-white';
		flushSync();
		expect(fx.state()).toBe('loading');
		expect(fx.q('[data-inspect-canvas]')?.classList.contains('hidden')).toBe(true);
		fx.answer();
		expect(fx.state()).toBe('ready');
	});

	it('opens on the remembered session geometry and lighting', () => {
		const fx = render({ settings: { geometry: 'plane', lighting: 'grazing' } });
		expect(fx.last().request).toMatchObject({ geometry: 'plane', lighting: 'library-grazing' });
		expect(fx.q('[data-inspect-geometry="plane"]')?.getAttribute('aria-pressed')).toBe('true');
		expect(fx.q('[data-inspect-lighting="grazing"]')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('shows the sample tile and says why when the host refuses the material', () => {
		const fx = render();
		fx.last().onState({ status: 'refused', issues: [{ code: 'subject-missing', action: 'x' }] } as InspectionState);
		flushSync();
		expect(fx.state()).toBe('refused');
		expect(fx.q('[data-inspect-note]')?.textContent).toMatch(/sample tile/);
	});
});
