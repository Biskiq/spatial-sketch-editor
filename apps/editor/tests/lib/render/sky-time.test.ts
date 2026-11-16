import { describe, expect, it } from 'vitest';
import { adjacentPhaseStart, hhmm, phaseName, skyBodyAt, skyDirection, snapTime } from '$lib/render/sky-time';

describe('24-hour Sun and Moon model', () => {
	it('keeps solar noon on the saved bearing and reaches the horizon at both endpoints', () => {
		expect(skyBodyAt(6.5, 90, 62)).toMatchObject({ body: 'sun', az: 0, el: 4 });
		expect(skyBodyAt(13, 90, 62)).toMatchObject({ body: 'sun', az: 90, el: 62 });
		expect(skyBodyAt(19.5, 90, 62)).toMatchObject({ body: 'sun', az: 180, el: 4 });
		expect(skyDirection(0, 0)).toEqual([0, 0, -1]);
		expect(skyDirection(90, 0)[0]).toBe(1);
	});
	it('crosses dusk, the lunar peak and dawn at the specified hours', () => {
		expect(skyBodyAt(19.51, 90, 62)).toMatchObject({ phase: 'dusk', body: 'none', az: 180 });
		expect(skyBodyAt(21, 90, 62)).toMatchObject({ phase: 'night', body: 'moon', el: 4 });
		expect(skyBodyAt(0.75, 90, 62)).toMatchObject({ phase: 'night', body: 'moon', el: 38 });
		expect(skyBodyAt(4.5, 90, 62)).toMatchObject({ phase: 'dawn', body: 'none', az: 0 });
		expect(phaseName(5)).toBe('Dawn · no direct light');
	});
	it('wraps the five-minute grid, display and keyboard phase steps', () => {
		expect(snapTime(23 + 57 / 60)).toBe(287 / 12);
		expect(snapTime(23 + 58 / 60)).toBe(0);
		expect(hhmm(23 + 59.9 / 60)).toBe('00:00');
		expect(adjacentPhaseStart(22, 1)).toBe(4.5);
		expect(adjacentPhaseStart(2, -1)).toBe(21);
		expect(adjacentPhaseStart(13, 1)).toBe(19.5);
	});
});
