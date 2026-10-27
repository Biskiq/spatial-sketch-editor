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
	/**
	 * Finish the live proposal (a drawing chain) — the same command its palette's
	 * Finish control runs. The armed tool's own controller answers it.
	 */
	| { readonly kind: 'finish' }
	/** Drop the live proposal's last point. */
	| { readonly kind: 'backtrack' }
	/** Offer the selected subject's own destructive action, wrapped in its disclosure. */
	| { readonly kind: 'delete' }
	/**
	 * Close the deepest open context, **palette first**: a live proposal is deeper
	 * than the task that produced it, so the chain cancels before the tool disarms.
	 */
	| { readonly kind: 'dismiss' }
	| { readonly kind: 'pan'; readonly deltaCss: readonly [number, number] }
	| { readonly kind: 'none' };

/**
 * The keyboard map, as a total function of `KeyboardEvent.key`.
 *
 * `Enter`/`Backspace`/`Delete` are the drawing and deletion commands. They are
 * **not** copied from the prototype: each one is either the command's own key
 * (the palette names Finish as Enter and Backtrack as Backspace) or the platform's
 * delete key, and none of them collides with the viewing map (3/p/f/arrows/Escape)
 * or with typing, which the text-entry guard already excludes.
 */
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
		case 'Enter':
			return { kind: 'finish' };
		case 'Backspace':
			return { kind: 'backtrack' };
		case 'Delete':
			return { kind: 'delete' };
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

/** Whether this pointer got the press, or must be ignored because another one owns it. */
export type StagePressOwnership = 'owned' | 'refused';

/**
 * The drag-versus-click decision, kept across the pointer sequence, **per pointer**.
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
 *
 * Ownership matters as much as ordering: every transition names the pointer it belongs
 * to, so a pointer that was refused the press can neither end the press that owns the
 * lease nor select through its own refused one.
 */
export type StagePressTracker = {
	/** A press began at this point for this pointer. */
	readonly begin: (
		point: { readonly x: number; readonly y: number },
		pointerId: number
	) => StagePressOwnership;
	/** This pointer's press was refused (the lease belongs to someone else). */
	readonly refuse: (pointerId: number) => void;
	/** A normal pointer ending; `false` when this pointer owned no press. */
	readonly end: (pointerId: number) => boolean;
	/**
	 * Hand the press to an adapter: the gesture is over and the click that follows
	 * selects nothing.
	 *
	 * An armed tool's tap is the tool's own gesture — it places a point, splits a
	 * Wall, or is refused — so it must never *also* move the selection. This is not
	 * `abort`: the creator did finish the press, the tool simply consumed it.
	 */
	readonly claim: (pointerId: number) => boolean;
	/** An interruption; with an id, only that pointer's press is interrupted. */
	readonly abort: (pointerId?: number) => boolean;
	/** Whether the click at this point may select. Always consumes the decision. */
	readonly decide: (
		point: { readonly x: number; readonly y: number },
		pointerId?: number | null
	) => boolean;
	/** Whether this pointer owns the live press (and so may move, end or select). */
	readonly ownsPointer: (pointerId: number) => boolean;
	/** The pointer that currently owns the press, or `null`. */
	readonly owner: () => number | null;
};

type StagePressPhase = 'idle' | 'pressed' | 'ended' | 'suppressed';

/** One tracker per Stage host: the sequence is host state, not event state. */
export function createStagePressTracker(): StagePressTracker {
	let phase: StagePressPhase = 'idle';
	let origin: { readonly x: number; readonly y: number } | null = null;
	let owner: number | null = null;
	/** Pointers refused the press; their click is not a selection. */
	const refused = new Set<number>();
	return {
		begin(point, pointerId) {
			if (phase === 'pressed' && owner !== null && owner !== pointerId) {
				refused.add(pointerId);
				return 'refused';
			}
			phase = 'pressed';
			owner = pointerId;
			origin = { x: point.x, y: point.y };
			return 'owned';
		},
		refuse(pointerId) {
			refused.add(pointerId);
		},
		end(pointerId) {
			// A refused pointer's mark is kept until its click consumes it; ending a press it
			// never owned changes nothing.
			if (owner !== pointerId || phase !== 'pressed') return false;
			phase = 'ended';
			return true;
		},
		claim(pointerId) {
			// The owner is kept until the click consumes the decision, exactly as `end`
			// leaves it: the pointer sequence and its click still have to match up.
			if (owner !== pointerId) return false;
			if (phase !== 'pressed' && phase !== 'ended') return false;
			phase = 'suppressed';
			return true;
		},
		abort(pointerId) {
			if (pointerId !== undefined && owner !== null && owner !== pointerId) return false;
			phase = 'suppressed';
			origin = null;
			owner = null;
			return true;
		},
		decide(point, pointerId) {
			const hasPointer = pointerId !== undefined && pointerId !== null;
			// A refused pointer never selects, whatever the distance or the phase.
			if (hasPointer && refused.delete(pointerId)) return false;
			// A click from another pointer is not the completion of this press, and must not
			// consume it: the owner's own click still arrives.
			if (hasPointer && owner !== null && pointerId !== owner) return false;
			const start = origin;
			const wasSuppressed = phase === 'suppressed';
			phase = 'idle';
			origin = null;
			owner = null;
			if (wasSuppressed) return false;
			// A click with no recorded press (a synthetic or programmatic activation) has no
			// drag to suppress; an ordinary press is judged by how far the pointer travelled.
			if (start === null) return true;
			return !isStageDrag(start, point);
		},
		owner: () => owner,
		ownsPointer(pointerId) {
			// Movement is the one transition a refused pointer still generates: its samples
			// sit at its own position, not the owner's, so they must not pan or orbit.
			return owner !== null && owner === pointerId;
		}
	};
}
