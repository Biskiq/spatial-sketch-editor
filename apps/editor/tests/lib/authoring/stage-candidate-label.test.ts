// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import StageOverlay from '$lib/authoring/stage/shell/StageOverlay.svelte';

it.each([928, 820])('keeps a crossing refusal inside a %spx Stage and clear of the Height Sheet', async (width) => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(StageOverlay, { target, props: {
		markers: [], viewportWidth: width, viewportHeight: 720,
		candidates: [{
			id: 'refused', role: 'refused', polygons: [], bounds: null,
			segments: [[[40, 450], [width - 10, 450]]],
			labels: [{ css: [width - 10, 450], text: 'The chain crosses an existing Wall without a Junction. End the chain on that Wall to split it, or draw into the existing Junction.' }]
		}]
	} });
	try {
		await tick();
		const tag = target.querySelector('.candidate .tag')!;
		const rect = tag.querySelector('rect')!;
		const [x, y] = tag.getAttribute('transform')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
		expect(x).toBeGreaterThanOrEqual(8);
		expect(x! + Number(rect.getAttribute('width'))).toBeLessThanOrEqual(width - 100);
		expect(y).toBeGreaterThanOrEqual(8);
		expect(y! + Number(rect.getAttribute('height'))).toBeLessThan(720);
		// Moving the words never changes the cursor's refused reach or invents a fill.
		expect(target.querySelectorAll('.candidate path')).toHaveLength(0);
		expect(target.querySelector('.candidate line')!.getAttribute('x2')).toBe(String(width - 10));
	} finally {
		await unmount(component);
		target.remove();
	}
});
