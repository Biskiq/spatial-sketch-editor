/**
 * V2c — the Card's three top shapes and their one-shot edits.
 *
 * The authored encoding is canonical (`LayoutWallTop`): a level top has no
 * profile, a slope names both end rises, a gable names both ends, an apex rise
 * and an apex station. These helpers turn the Card's Level/Slope/Gable choice,
 * its Rise and Apex fields, and a dragged absolute breakpoint into that one
 * encoding; `planSetWallTop` remains the only writer and owns every refusal.
 *
 * Defaults are deliberately bounded: switching to Slope raises the far end by a
 * 30° pitch over the Wall's length, and switching to Gable keeps the existing
 * ends and puts the apex at the middle by the same 30° pitch. Switching shapes
 * therefore never lowers an existing end and never invents a negative rise.
 */
import { WALL_HEIGHT_EPSILON, type LayoutWallTop } from '@portfolio/layout-core/wall';

export const WALL_TOP_SHAPES = [
	{ kind: 'level', label: 'Level' },
	{ kind: 'slope', label: 'Slope' },
	{ kind: 'gable', label: 'Gable' },
] as const;

export type WallTopShape = (typeof WALL_TOP_SHAPES)[number]['kind'];

/** The default pitch: 30°, the pitch the plan's design specimens read at. */
export const WALL_TOP_DEFAULT_PITCH_RADIANS = Math.PI / 6;

function defaultRise(length: number): number {
	return Math.tan(WALL_TOP_DEFAULT_PITCH_RADIANS) * Math.max(0, length);
}

/**
 * The top a shape button installs from the Wall's current top.
 *
 * A shape button is a no-op when the top already has that shape: the instrument
 * returns accepted without a write, so the history stays one entry per change.
 */
export function wallTopForShape(
	shape: WallTopShape,
	length: number,
	current: LayoutWallTop,
): LayoutWallTop {
	switch (shape) {
		case 'level':
			return { kind: 'level' };
		case 'slope':
			if (current.kind === 'slope') return current;
			if (current.kind === 'gable') {
				const ends = { startRise: current.startRise, endRise: current.endRise };
				const highest = Math.max(ends.startRise, ends.endRise);
				return highest > WALL_HEIGHT_EPSILON
					? { kind: 'slope', ...ends }
					: { kind: 'slope', startRise: 0, endRise: defaultRise(length) };
			}
			return { kind: 'slope', startRise: 0, endRise: defaultRise(length) };
		case 'gable': {
			if (current.kind === 'gable') return current;
			if (current.kind === 'level') {
				return {
					kind: 'gable',
					startRise: 0,
					endRise: 0,
					apexRise: defaultRise(length / 2),
					apexOffset: length / 2,
				};
			}
			const highest = Math.max(current.startRise, current.endRise);
			return {
				kind: 'gable',
				startRise: current.startRise,
				endRise: current.endRise,
				// Keep both ends and lift the apex above the higher one, so switching
				// from a slope adds a peak without moving the authored ends.
				apexRise: (highest > WALL_HEIGHT_EPSILON ? highest : 0) + defaultRise(length / 2),
				apexOffset: length / 2,
			};
		}
	}
}

/** Rise is the slope's high end or the gable's apex; a level Wall has none. */
export function wallTopWithRise(top: LayoutWallTop, rise: number): LayoutWallTop | null {
	switch (top.kind) {
		case 'level':
			return null;
		case 'slope':
			return top.startRise > top.endRise
				? { kind: 'slope', startRise: rise, endRise: 0 }
				: { kind: 'slope', startRise: 0, endRise: rise };
		case 'gable':
			return { ...top, apexRise: rise };
	}
}

/** Apex position is the gable's apex station; other shapes have none. */
export function wallTopWithApexPosition(
	top: LayoutWallTop,
	apexOffset: number,
): LayoutWallTop | null {
	return top.kind === 'gable' ? { ...top, apexOffset } : null;
}

/** The centred gable: keep the rises and put the apex at half the length. */
export function wallTopWithCentredApex(top: LayoutWallTop, length: number): LayoutWallTop | null {
	return wallTopWithApexPosition(top, length / 2);
}

export function wallTopApexIsCentred(top: LayoutWallTop, length: number): boolean {
	return top.kind === 'gable' && Math.abs(top.apexOffset - length / 2) <= WALL_HEIGHT_EPSILON;
}

export type WallTopKnob = 'start' | 'apex' | 'end';

/**
 * The authored top implied by dragging one breakpoint to an absolute local top.
 *
 * `topLocal` is measured from the Floor datum, exactly like `wall.height`, so a
 * knob at 4.2 m always commits a 4.2 m top at that station. The lowest
 * breakpoint becomes `height` (the planner's normal form); collapsing a slope
 * to equal ends becomes level, and collapsing a gable's apex onto its ends
 * becomes the slope through them instead of a refusal.
 */
export function wallTopForKnobDrag(input: {
	readonly current: LayoutWallTop;
	/** The Wall's authored eave above the Floor datum, the norm form's base. */
	readonly height: number;
	readonly knob: WallTopKnob;
	readonly topLocal: number;
	readonly length: number;
}): { readonly height: number; readonly top: LayoutWallTop } {
	const { current, height, knob, topLocal, length } = input;
	const startTop = knob === 'start' ? topLocal : height + breakpointRise(current, 'start');
	const endTop = knob === 'end' ? topLocal : height + breakpointRise(current, 'end');
	const apexTop =
		current.kind === 'gable' ? (knob === 'apex' ? topLocal : height + current.apexRise) : null;
	return wallTopFromAbsoluteBreakpoints({
		startTop,
		apexTop,
		endTop,
		apexOffset: current.kind === 'gable' ? current.apexOffset : length / 2,
	});
}

/** The rise of one breakpoint relative to the Wall's eave. */
function breakpointRise(current: LayoutWallTop, knob: WallTopKnob): number {
	switch (current.kind) {
		case 'level':
			return 0;
		case 'slope':
			return knob === 'start'
				? current.startRise
				: knob === 'apex'
					? Math.max(current.startRise, current.endRise)
					: current.endRise;
		case 'gable':
			return knob === 'start'
				? current.startRise
				: knob === 'apex'
					? current.apexRise
					: current.endRise;
	}
}

export function wallTopFromAbsoluteBreakpoints(input: {
	readonly startTop: number;
	readonly apexTop: number | null;
	readonly endTop: number;
	readonly apexOffset: number;
}): { readonly height: number; readonly top: LayoutWallTop } {
	const base = Math.min(input.startTop, input.endTop);
	const startRise = input.startTop - base;
	const endRise = input.endTop - base;
	const level = Math.abs(input.startTop - input.endTop) <= WALL_HEIGHT_EPSILON;
	if (
		input.apexTop === null ||
		input.apexTop <= Math.max(input.startTop, input.endTop) + WALL_HEIGHT_EPSILON
	) {
		return level
			? { height: input.startTop, top: { kind: 'level' } }
			: { height: base, top: { kind: 'slope', startRise, endRise } };
	}
	return {
		height: base,
		top: {
			kind: 'gable',
			startRise,
			endRise,
			apexRise: input.apexTop - base,
			apexOffset: input.apexOffset,
		},
	};
}
