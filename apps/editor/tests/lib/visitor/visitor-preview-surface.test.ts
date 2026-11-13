// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { computeEnvelopeSourceContentId, lowerExperienceProgram, prepareUnitRuntime } from '@portfolio/project-model/units';
import VisitorPreviewSurface from '$lib/visitor/VisitorPreviewSurface.svelte';
import { experienceEnvelope, LOWERING_OPTIONS } from '../experience/fixtures';

vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
});

// The Canvas is a closed renderer boundary; controls run against the real runtime and time map.
vi.mock('@threlte/core', async (importOriginal) => ({ ...await importOriginal<typeof import('@threlte/core')>(), Canvas: (await import('./fixtures/MockOrbitControls.svelte')).default }));
let cleanup: (() => void) | null = null;
afterEach(() => { cleanup?.(); cleanup = null; document.body.replaceChildren(); });

async function mounted(mode: 'preview' | 'public' = 'preview', startMode: 'guided' | 'welcome' = 'guided') {
	const envelope = await experienceEnvelope();
	const ready = prepareUnitRuntime(envelope);
	if (ready.kind !== 'ready') throw Error('fixture not ready');
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const lowered = lowerExperienceProgram(envelope, { ...LOWERING_OPTIONS, sourceContentId });
	if (lowered.kind !== 'lowered') throw Error(lowered.message);
	const target = document.createElement('div'); document.body.append(target);
	const component = mount(VisitorPreviewSurface, { target, props: {
		scene: ready.runtimeScene, geometry: ready.geometry, graph: ready.graph,
		program: lowered.program, experienceOptions: { runId: 'run-surface', runEpoch: 1, sourceContentId, transitions: lowered.transitions },
		resolveTexture: () => null, startMode, mode
	} });
	cleanup = () => unmount(component);
	await tick(); await tick();
	return target;
}

describe('Preview timeline controls', () => {
	it('starts paused, sizes stays and Travel from their actual durations, and rewinds with the keyboard', async () => {
		const target = await mounted();
		expect(target.textContent).toContain('▶ Play');
		const slider = target.querySelector<HTMLElement>('[role="slider"]')!;
		expect(slider).not.toBeNull();
		expect(slider.getAttribute('aria-valuenow')).toBe('0');
		const timed = [...slider.querySelectorAll<HTMLElement>('.hold,.travel')];
		expect(timed.map((entry) => Number(entry.style.getPropertyValue('--seconds')))).toEqual([1, 4, 2]);
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
		await tick();
		expect(target.textContent).toContain('Stop 2 of 2');
		expect(slider.getAttribute('aria-valuenow')).toBe('5');
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await tick();
		expect(target.textContent).toContain('Stop 1 of 2');
		expect(slider.getAttribute('aria-valuenow')).toBe('0');
		expect(target.textContent).toContain('▶ Play');
	});


	it('pointer scrubbing can enter a Travel and rewind while keeping a paused Preview paused', async () => {
		const target = await mounted();
		const slider = target.querySelector<HTMLElement>('[role="slider"]')!;
		slider.setPointerCapture = vi.fn();
		const spans = [...slider.querySelectorAll<HTMLElement>('[data-time-segment]')];
		const boxes = [[0, 100], [100, 400], [500, 200]];
		spans.forEach((span, index) => {
			const [left, width] = boxes[index]!;
			span.getBoundingClientRect = () => ({ left, right: left! + width!, width, top: 0, bottom: 16, height: 16, x: left, y: 0, toJSON() {} }) as DOMRect;
		});
		const pointer = (type: string, clientX: number) => {
			const event = new MouseEvent(type, { clientX, button: 0, bubbles: true });
			Object.defineProperty(event, 'pointerId', { value: 1 });
			slider.dispatchEvent(event);
		};
		pointer('pointerdown', 300); await tick();
		expect(target.textContent).toContain('Stop 2 of 2');
		expect(target.textContent).toContain('Moving to Stop 2');
		pointer('pointermove', 50); await tick();
		pointer('pointerup', 50); await tick();
		expect(target.textContent).toContain('Stop 1 of 2');
		expect(slider.getAttribute('aria-valuenow')).toBe('0.5');
		expect(target.textContent).toContain('▶ Play');
	});


	it('keeps the completed Preview timeline available for rewind', async () => {
		const target = await mounted();
		const next = () => [...target.querySelectorAll<HTMLButtonElement>('button')].find((button) => ['Next →', 'Finish'].includes(button.textContent?.trim() ?? ''))!.click();
		next(); await tick(); // Start the arrival Travel.
		next(); await tick(); // Land at Stop 2.
		next(); await tick(); // Finish.
		expect(target.querySelector('[aria-label="End of the tour"]')).not.toBeNull();
		const slider = target.querySelector<HTMLElement>('[role="slider"]')!;
		expect(slider.getAttribute('aria-valuenow')).toBe('7');
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await tick();
		expect(target.querySelector('[aria-label="End of the tour"]')).toBeNull();
		expect(slider.getAttribute('aria-valuenow')).toBe('0');
		expect(target.textContent).toContain('▶ Play');
	});


	it('choosing the tour from the Preview welcome starts paused', async () => {
		const target = await mounted('preview', 'welcome');
		expect(target.querySelector('[role="slider"]')).toBeNull();
		[...target.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Take the guided tour'))!.click();
		await tick();
		expect(target.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('0');
		expect(target.textContent).toContain('▶ Play');
	});

	it('public entry retains its existing autoplay and read-only progress', async () => {
		const target = await mounted('public');
		expect(target.textContent).toContain('❚❚ Pause');
		expect(target.querySelector('[role="slider"]')).toBeNull();
		expect(target.querySelector('[role="progressbar"]')).not.toBeNull();
	});
});
