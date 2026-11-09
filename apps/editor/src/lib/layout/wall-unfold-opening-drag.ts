/**
 * S5b — the pure station mapping for an Opening edit on the developed sheet.
 *
 * The sheet addresses canonical stations; this module only converts a pointer
 * station into the one field the existing `layout-opening-measure` planner
 * writes. It owns no document, history, selection or mesh.
 */

export type SheetOpeningMode = 'slide' | 'left' | 'right';

export type SheetOpeningEdit = {
	readonly offset: number;
	readonly width: number;
	readonly field: 'offset' | 'width';
	readonly value: number;
};

const MIN_OPENING_WIDTH = 0.1;
/** Canonical validity refuses a width equal to the whole closed circumference. */
const MAX_WIDTH_EPSILON = 1e-6;

function wrapStation(station: number, length: number): number {
	if (!(length > 0)) return 0;
	const result = station % length;
	return result < 0 ? result + length : result;
}

export function sheetOpeningModeFromEdges(
	leftDistanceCss: number,
	rightDistanceCss: number,
	thresholdCss = 12
): SheetOpeningMode {
	if (!(leftDistanceCss <= thresholdCss) && !(rightDistanceCss <= thresholdCss)) return 'slide';
	return leftDistanceCss <= rightDistanceCss ? 'left' : 'right';
}

/** Shortest display-station delta, so a drag across a closed seam is continuous. */
export function sheetStationDelta(from: number, to: number, length: number, closed: boolean): number {
	let delta = to - from;
	if (closed && length > 0) {
		delta = (((delta + length / 2) % length) + length) % length - length / 2;
	}
	return delta;
}

export function mapSheetOpeningDrag(input: {
	readonly mode: SheetOpeningMode;
	readonly startOffset: number;
	readonly startWidth: number;
	readonly grabStation: number;
	readonly pointerStation: number;
	readonly length: number;
	readonly closed: boolean;
}): SheetOpeningEdit {
	const delta = sheetStationDelta(input.grabStation, input.pointerStation, input.length, input.closed);
	if (input.mode === 'slide') {
		// A closed Wall is periodic: any authored offset in `[0, L)` is legal, so
		// sliding wraps through the canonical seam instead of stopping at `L - width`.
		const offset = input.closed
			? wrapStation(input.startOffset + delta, input.length)
			: Math.min(input.length - input.startWidth, Math.max(0, input.startOffset + delta));
		return { offset, width: input.startWidth, field: 'offset', value: offset };
	}
	if (input.mode === 'left') {
		const fixed = input.startOffset + input.startWidth;
		// On a closed host the fixed right edge may itself sit past `L`; the moving
		// left edge must stay below `L` and leave less than the full circumference.
		const lower = input.closed ? Math.max(0, fixed - input.length + MAX_WIDTH_EPSILON) : 0;
		const upper = input.closed
			? Math.min(fixed - MIN_OPENING_WIDTH, input.length - MAX_WIDTH_EPSILON)
			: fixed - MIN_OPENING_WIDTH;
		const offset = Math.min(Math.max(lower, input.startOffset + delta), upper);
		const width = fixed - offset;
		return { offset, width, field: 'width', value: width };
	}
	const maxWidth = input.closed
		? input.length - MAX_WIDTH_EPSILON
		: input.length - input.startOffset;
	const width = Math.min(maxWidth, Math.max(MIN_OPENING_WIDTH, input.startWidth + delta));
	return { offset: input.startOffset, width, field: 'width', value: width };
}
