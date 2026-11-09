import { describe, expect, it } from 'vitest';

import {
	mapSheetOpeningDrag,
	sheetOpeningModeFromEdges,
	sheetStationDelta
} from '../../../src/lib/layout/wall-unfold-opening-drag';

describe('S5b — sheet Opening drag mapping', () => {
	it('slides the body and preserves width', () => {
		const edit = mapSheetOpeningDrag({
			mode: 'slide', startOffset: 2, startWidth: 1, grabStation: 2.5, pointerStation: 3.25,
			length: 10, closed: false
		});
		expect(edit).toEqual({ offset: 2.75, width: 1, field: 'offset', value: 2.75 });
	});

	it('resizes the left jamb with the right edge fixed', () => {
		const edit = mapSheetOpeningDrag({
			mode: 'left', startOffset: 2, startWidth: 1, grabStation: 2, pointerStation: 2.4,
			length: 10, closed: false
		});
		expect(edit.offset).toBeCloseTo(2.4, 9);
		expect(edit.width).toBeCloseTo(0.6, 9);
		expect(edit.field).toBe('width');
	});

	it('resizes the right jamb with the left edge fixed', () => {
		const edit = mapSheetOpeningDrag({
			mode: 'right', startOffset: 2, startWidth: 1, grabStation: 3, pointerStation: 2.2,
			length: 10, closed: false
		});
		expect(edit.offset).toBe(2);
		expect(edit.width).toBeCloseTo(0.2, 9);
	});

	it('takes the shortest delta across a closed seam', () => {
		expect(sheetStationDelta(9.9, 0.1, 10, true)).toBeCloseTo(0.2, 9);
		const edit = mapSheetOpeningDrag({
			mode: 'right', startOffset: 9, startWidth: 0.8, grabStation: 9.8, pointerStation: 0.1,
			length: 10, closed: true
		});
		// A closed host is periodic, so the jamb may cross the seam: width grows
		// past `length - startOffset`; only the whole circumference is refused.
		expect(edit.offset).toBe(9);
		expect(edit.width).toBeCloseTo(1.1, 9);
	});

	it('slides a seam-crossing Opening through the canonical seam', () => {
		const edit = mapSheetOpeningDrag({
			mode: 'slide', startOffset: 9.8, startWidth: 0.5, grabStation: 0.05, pointerStation: 0.25,
			length: 10, closed: true
		});
		expect(edit.offset).toBeCloseTo(0, 9);
		expect(edit.width).toBe(0.5);
	});

	it('never authors the whole closed circumference', () => {
		const edit = mapSheetOpeningDrag({
			mode: 'right', startOffset: 1, startWidth: 9.95, grabStation: 9.9, pointerStation: 0.1,
			length: 10, closed: true
		});
		expect(edit.width).toBeLessThan(10);
	});

	it('keeps a minimum width and the Opening inside its Wall', () => {
		expect(mapSheetOpeningDrag({
			mode: 'left', startOffset: 2, startWidth: 1, grabStation: 2, pointerStation: 3.5,
			length: 10, closed: false
		}).width).toBeCloseTo(0.1, 9);
		expect(mapSheetOpeningDrag({
			mode: 'slide', startOffset: 8, startWidth: 1, grabStation: 8.5, pointerStation: 12,
			length: 10, closed: false
		}).offset).toBe(9);
	});

	it('chooses a jamb only within the visible edge tolerance', () => {
		expect(sheetOpeningModeFromEdges(4, 30)).toBe('left');
		expect(sheetOpeningModeFromEdges(30, 7)).toBe('right');
		expect(sheetOpeningModeFromEdges(20, 24)).toBe('slide');
	});
});
