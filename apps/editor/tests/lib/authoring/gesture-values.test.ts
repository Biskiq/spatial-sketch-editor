import { expect, it } from 'vitest';
import { angleDeltaLabel, planarDeltaLabel, sizeDeltaLabel } from '$lib/authoring/stage/gesture-values';
it('starts each rotated invocation at zero and crosses the angular wrap without a world-heading jump', () => {
	const degrees = (value: number) => value * Math.PI / 180;
	expect(angleDeltaLabel(degrees(179), degrees(179))).toBe('Δθ 0.0°');
	expect(angleDeltaLabel(degrees(-178), degrees(179))).toBe('Δθ +3.0°');
	expect(angleDeltaLabel(degrees(178), degrees(-179))).toBe('Δθ −3.0°');
	expect(planarDeltaLabel(-.00001, .5)).toBe('Δx 0.00 · Δz +0.50 m');
	expect(sizeDeltaLabel(3.2, 3)).toBe('Δ +0.20 m → 3.20 m');
});
