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
			id: 'refused', role: 'refused', polygons: [],
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

it('gives a candidate line a dark halo and says a refusal once', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(StageOverlay, { target, props: {
		markers: [], viewportWidth: 900, viewportHeight: 720,
		marks: [{
			id: 'held', kind: 'point', role: 'edit', anchor: [100, 100], tip: null, tail: null, ring: null,
			label: 'Junction', tag: 'Junction', refusal: 'This would cross or meet another Wall.', active: true, hovered: false, open: false
		}],
		candidates: [{
			id: 'refused', role: 'refused', polygons: [],
			segments: [[[100, 100], [300, 300]]],
			labels: [{ css: [300, 300], text: 'This would cross or meet another Wall.' }]
		}]
	} as never });
	try {
		await tick();
		const lines = [...target.querySelectorAll('.candidate line')];
		expect(lines).toHaveLength(2);
		expect(lines[0]!.classList.contains('candidate-halo')).toBe(true);
		expect(lines[1]!.classList.contains('candidate-edge')).toBe(true);
		expect(target.querySelectorAll('.tag')).toHaveLength(1);
		expect(target.querySelector('.mark .tag')).toBeNull();
	} finally {
		await unmount(component);
		target.remove();
	}
});
