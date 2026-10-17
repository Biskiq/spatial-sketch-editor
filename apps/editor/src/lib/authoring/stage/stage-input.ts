/**
 * The host's **input policy**: the keyboard map and the two rules that decide how
 * a pointer or a reading request is interpreted.
 *
 * These are deliberately pure mappings rather than behaviour buried in the route.
 * A defect that made `Escape` clear the selection before closing the task, that let
 * a key typed into the Index's search field move the camera, that treated a pan as
 * a click, or that ran a reading transition under reduced motion instead of cutting
 * to its declared endpoint, is otherwise only visible in a browser. The route
 * realizes the returned action through the seam and owns no second map.
 */
import { VIEWPORT_READING_TRANSITION_SECONDS } from '@portfolio/camera-core';
import type { ViewingIntent } from '@portfolio/camera-core';

/** What one key asks the Stage to do. */
export type StageKeyAction =
	| { readonly kind: 'reading'; readonly reading: '3d' | 'plan' }
	| { readonly kind: 'fit' }
	/** Close the deepest open context: the task first, then the selection. */
	| { readonly kind: 'dismiss' }
	| { readonly kind: 'pan'; readonly deltaCss: readonly [number, number] }
	| { readonly kind: 'none' };

/** The keyboard map, as a total function of `KeyboardEvent.key`. */
export function stageKeyAction(key: string): StageKeyAction {
	switch (key) {
		case '3':
			return { kind: 'reading', reading: '3d' };
		case 'p':
		case 'P':
			return { kind: 'reading', reading: 'plan' };
		case 'f':
		case 'F':
			return { kind: 'fit' };
		case 'Escape':
			return { kind: 'dismiss' };
		case 'ArrowLeft':
			return { kind: 'pan', deltaCss: [40, 0] };
		case 'ArrowRight':
			return { kind: 'pan', deltaCss: [-40, 0] };
		case 'ArrowUp':
			return { kind: 'pan', deltaCss: [0, 40] };
		case 'ArrowDown':
			return { kind: 'pan', deltaCss: [0, -40] };
		default:
			return { kind: 'none' };
	}
}

/**
 * The text-entry guard: typing into the Index's subject search (or any other text
 * field) must never pan, fit or flip the reading.
 */
export function stageKeyFromTextEntry(target: unknown): boolean {
	if (typeof target !== 'object' || target === null) return false;
	const record = target as { readonly tagName?: unknown; readonly isContentEditable?: unknown };
	if (record.isContentEditable === true) return true;
	const tag = typeof record.tagName === 'string' ? record.tagName.toUpperCase() : '';
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * The clock a reading request is **dated at**.
 *
 * Under reduced motion the request is dated **before** its own declared transition,
 * so the very next frame — which evaluates at the real clock — is already past the
 * endpoint. That is the one settling rule's own answer (`progress` 1 at a clock
 * past the endpoint), never a shortened tween, never a private snap path, and never
 * a request dated at or after the frame that draws it (that one would start its
 * transition there and animate exactly as usual).
 *
 * The margin is a second rather than exactly the transition's duration because the
 * comparison is on computed progress: subtracting the duration alone lands a hair
 * under 1 in floating point, and the flip would then be drawn mid-flight for a
 * frame — the one thing reduced motion must not do.
 */
export const REDUCED_MOTION_CLOCK_MARGIN_SECONDS = 1;

export function readingIntentClockSeconds(reducedMotion: boolean, nowSeconds: number): number {
	return reducedMotion
		? nowSeconds - VIEWPORT_READING_TRANSITION_SECONDS - REDUCED_MOTION_CLOCK_MARGIN_SECONDS
		: nowSeconds;
}

/** The distance a pointer may travel and still count as a click, in CSS pixels. */
export const STAGE_CLICK_TOLERANCE_CSS_PX = 4;

/**
 * Whether a pointer gesture was a drag rather than a click.
 *
 * A pan or orbit drag ends with a `click` event too, so without this a pan of any
 * distance would also select whatever sits under the release point (or scold the
 * creator for selecting nothing).
 */
export function isStageDrag(
	origin: { readonly x: number; readonly y: number },
	point: { readonly x: number; readonly y: number }
): boolean {
	return Math.hypot(point.x - origin.x, point.y - origin.y) > STAGE_CLICK_TOLERANCE_CSS_PX;
}

/**
 * The drag-versus-click decision, kept across the pointer sequence.
 *
 * A pan or orbit ends with a `click` event as well, and that click arrives **after**
 * `pointerup` — so the press origin has to outlive the pointer ending. Clearing it in
 * the pointer-up handler silently defeats this whole rule: every drag would select
 * whatever sits under the release point.
 *
 * The three endings are therefore distinct. `end()` is a normal release: the gesture
 * is over, a click may still arrive, and that click is judged by distance. `abort()` is
 * an interruption (pointer cancel, capture lost while the pointer is down, Escape, a
 * policy cancel): the gesture is over and the click that may still be dispatched must
 * not select. `decide()` consumes the press, so one press can authorize at most one
 * selection.
 */
export type StagePressTracker = {
	/** A press began at this point. */
	readonly begin: (point: { readonly x: number; readonly y: number }) => void;
	/** A normal pointer ending: the click decision survives for the click that follows. */
	readonly end: () => void;
	/** An interruption: no following click may select. */
	readonly abort: () => void;
	/** Whether the click at this point may select. Always consumes the decision. */
	readonly decide: (point: { readonly x: number; readonly y: number }) => boolean;
};

type StagePressPhase = 'idle' | 'pressed' | 'ended' | 'suppressed';

export function createStagePressTracker(): StagePressTracker {
	let phase: StagePressPhase = 'idle';
	let origin: { readonly x: number; readonly y: number } | null = null;
	return {
		begin(point) {
			phase = 'pressed';
			origin = { x: point.x, y: point.y };
		},
		end() {
			if (phase === 'pressed') phase = 'ended';
		},
		abort() {
			phase = 'suppressed';
			origin = null;
		},
		decide(point) {
			const start = origin;
			const wasSuppressed = phase === 'suppressed';
			phase = 'idle';
			origin = null;
			if (wasSuppressed) return false;
			// A click with no recorded press (a synthetic or programmatic activation) has no
			// drag to suppress; an ordinary press is judged by how far the pointer travelled.
			if (start === null) return true;
			return !isStageDrag(start, point);
		}
	};
}
