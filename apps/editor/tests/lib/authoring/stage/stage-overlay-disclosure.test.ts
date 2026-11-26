// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import StageOverlay from '$lib/authoring/stage/shell/StageOverlay.svelte';
import type { StageMarkView } from '$lib/authoring/stage/stage-handles';

const chip: StageMarkView = {
	adapterId: 'layout', id: 'layout-wall-size-chip', role: 'disclose', kind: 'point', label: 'Wall size',
	fact: null, planner: null, anchor: [100, 80], tip: null, tail: null, ring: null,
	hidden: false, hitSegments: [], tag: '', refusal: null, open: false, active: false, hovered: false,
	descriptor: {} as StageMarkView['descriptor']
};

// A real browser hit-tests the overlay before the Stage resolver sees a press.
// The chip must not answer that hit itself: a press it swallowed never reached
// the resolver, which would have named a neighbouring Wall end knob, and the
// knob's drag silently did nothing (the perf:spot Wall-drag stall).
it('lets a press on the Size chip reach the Stage, and still activates it from the keyboard', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const activated: string[] = [];
	const reached: string[] = [];
	target.addEventListener('pointerdown', () => reached.push('pointerdown'));
	const component = mount(StageOverlay, { target, props: {
		markers: [], marks: [chip], viewportWidth: 800, viewportHeight: 600,
		onActivateDisclosure: (id: string) => activated.push(id)
	} });
	try {
		await tick();
		const mark = target.querySelector<SVGGElement>('g.mark[data-mark-id="layout-wall-size-chip"]')!;
		expect(mark.getAttribute('role')).toBe('button');
		expect(mark.getAttribute('tabindex')).toBe('0');
		// No overlay-only hit area extends the chip past the resolver's own target.
		expect(mark.querySelector('.toggle-hit')).toBeNull();

		mark.querySelector('.glyph')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(reached).toEqual(['pointerdown']);
		expect(activated).toEqual([]);

		mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		mark.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		// Assistive technology activates a button with a click.
		mark.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(activated).toEqual(['layout-wall-size-chip', 'layout-wall-size-chip', 'layout-wall-size-chip']);
	} finally {
		await unmount(component);
		target.remove();
	}
});

/** The chip as the Stage projects it, with an optional published reading. */
function readingChip(reading: string | undefined, state: { open?: boolean; hovered?: boolean }): StageMarkView {
	return {
		...chip,
		label: 'Size',
		tag: reading ?? '',
		hovered: state.hovered ?? false,
		open: state.open ?? false,
		descriptor: {
			id: 'layout-wall-size-chip',
			kind: 'point',
			role: 'disclose',
			anchor: [100, 0, 80],
			label: 'Size',
			reveals: ['layout-wall-thickness'],
			...(reading === undefined ? {} : { value: reading })
		} as StageMarkView['descriptor']
	};
}

async function renderChip(mark: StageMarkView): Promise<{
	readonly tag: string | null;
	readonly ariaLabel: string | null;
	readonly title: string;
}> {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(StageOverlay, { target, props: {
		markers: [], marks: [mark], viewportWidth: 800, viewportHeight: 600
	} });
	try {
		await tick();
		const group = target.querySelector<SVGGElement>('g.mark[data-mark-id="layout-wall-size-chip"]')!;
		return {
			tag: group.querySelector('.tag text')?.textContent ?? null,
			ariaLabel: group.getAttribute('aria-label'),
			title: group.querySelector('title')?.textContent ?? ''
		};
	} finally {
		await unmount(component);
		target.remove();
	}
}

// A7.3 — a disclosure's `value` is a read-only reading (the curved Wall's arc
// length). It must appear in the one tag renderer, including on the tap path,
// while a disclosure with no reading keeps today's tag-free chip.
it('shows a disclosure reading only when it has one and is hovered or open', async () => {
	const reading = 'Length (arc) 3.214 m';

	const idle = await renderChip(readingChip(reading, {}));
	expect(idle.tag).toBeNull();
	expect(idle.ariaLabel).toBe(`Resize handles · ${reading}`);
	expect(idle.title).toBe(`Size · ${reading}`);

	const hovered = await renderChip(readingChip(reading, { hovered: true }));
	expect(hovered.tag).toBe(reading);

	// Open is the coarse-pointer path: a tap must reveal the reading.
	const open = await renderChip(readingChip(reading, { open: true }));
	expect(open.tag).toBe(reading);

	const plain = await renderChip(readingChip(undefined, { hovered: true }));
	expect(plain.tag).toBeNull();
	expect(plain.ariaLabel).toBe('Resize handles');
});
