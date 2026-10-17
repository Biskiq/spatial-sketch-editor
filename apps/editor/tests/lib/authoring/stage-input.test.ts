/**
 * T1.P01.S02 — the host's **input policy**, as a pure mapping.
 *
 * `src/lib/authoring/stage/stage-input.ts` holds the decisions the route would
 * otherwise bury in listeners, and each of them is a defect with a browser-only
 * symptom:
 *
 * 1. the keyboard map — a key that moves the camera when the creator is typing in
 *    the Index's search field, or that closes the task and the selection in the
 *    wrong order, cannot be seen in a lane report;
 * 2. the drag rule — a pan or orbit ends with a `click` too, so a missing
 *    tolerance selects whatever sits under the release point (or scolds the
 *    creator for a click that was a drag);
 * 3. the reduced-motion clock — a reading request under reduced motion must cut
 *    to the declared endpoint through the one settling rule, not run a shortened
 *    tween and not run the ordinary transition.
 *
 * The map is a total function, so the suite pins its *whole* domain rather than a
 * sample: an unlisted key answers `none`, and the four arrows are two mirrored
 * pairs (a pair that pointed the same way would double-pan one axis and never
 * move the other).
 */
import { describe, expect, it } from 'vitest';
import {
	VIEWPORT_READING_TRANSITION_SECONDS,
	createViewportCameraState,
	evaluateViewport,
	requestViewingIntent
} from '@portfolio/camera-core';
import type { ViewportRect } from '@portfolio/camera-core';
import {
	STAGE_CLICK_TOLERANCE_CSS_PX,
	createStagePressTracker,
	isStageDrag,
	readingIntentClockSeconds,
	stageKeyAction,
	stageKeyFromTextEntry
} from '$lib/authoring/stage/stage-input';

const RECT: ViewportRect = { left: 0, top: 0, width: 1280, height: 720, devicePixelRatio: 1 };

describe('Stage input policy', () => {
	it('maps every key it claims, in both letter cases, and answers none otherwise', () => {
		expect(stageKeyAction('3')).toEqual({ kind: 'reading', reading: '3d' });
		expect(stageKeyAction('p')).toEqual({ kind: 'reading', reading: 'plan' });
		expect(stageKeyAction('P')).toEqual({ kind: 'reading', reading: 'plan' });
		expect(stageKeyAction('f')).toEqual({ kind: 'fit' });
		expect(stageKeyAction('F')).toEqual({ kind: 'fit' });
		expect(stageKeyAction('Escape')).toEqual({ kind: 'dismiss' });

		// The arrows are two mirrored pairs: the same sign on both members of a pair
		// would pan one axis twice and leave the other still.
		const left = stageKeyAction('ArrowLeft');
		const right = stageKeyAction('ArrowRight');
		const up = stageKeyAction('ArrowUp');
		const down = stageKeyAction('ArrowDown');
		expect(left).toEqual({ kind: 'pan', deltaCss: [40, 0] });
		expect(right).toEqual({ kind: 'pan', deltaCss: [-40, 0] });
		expect(up).toEqual({ kind: 'pan', deltaCss: [0, 40] });
		expect(down).toEqual({ kind: 'pan', deltaCss: [0, -40] });
		for (const [first, second] of [
			[left, right],
			[up, down]
		] as const) {
			if (first.kind !== 'pan' || second.kind !== 'pan') throw new Error('the arrows are a pan pair');
			expect([first.deltaCss[0] + second.deltaCss[0], first.deltaCss[1] + second.deltaCss[1]]).toEqual([0, 0]);
		}

		// Total: nothing outside the map moves the camera, and a modified key is not
		// recognised by its bare character (`'p'` with Control held is `Paste`, and
		// the route consults the modifier state — the map itself claims no chords).
		for (const key of ['a', 'Escapee', ' ', 'Enter', 'Delete', 'ArrowLeft ', '0', '2']) {
			expect(stageKeyAction(key), key).toEqual({ kind: 'none' });
		}
	});

	it('never reads a key typed into a text field', () => {
		expect(stageKeyFromTextEntry({ tagName: 'INPUT' })).toBe(true);
		expect(stageKeyFromTextEntry({ tagName: 'textarea' })).toBe(true);
		expect(stageKeyFromTextEntry({ tagName: 'select' })).toBe(true);
		expect(stageKeyFromTextEntry({ isContentEditable: true })).toBe(true);

		// The Stage surface itself (and its chrome) must still answer keys.
		expect(stageKeyFromTextEntry({ tagName: 'DIV' })).toBe(false);
		expect(stageKeyFromTextEntry({ tagName: 'CANVAS', isContentEditable: false })).toBe(false);
		expect(stageKeyFromTextEntry({ isContentEditable: false })).toBe(false);
		// Events that arrive without a usable target do not silently swallow input.
		expect(stageKeyFromTextEntry(null)).toBe(false);
		expect(stageKeyFromTextEntry(undefined)).toBe(false);
		expect(stageKeyFromTextEntry('INPUT')).toBe(false);
		expect(stageKeyFromTextEntry({ tagName: 7 })).toBe(false);
	});

	it('cuts a reading request to its declared endpoint under reduced motion', () => {
		// Not a shortened tween: the request is dated one full transition in the
		// past, so the first frame drawn after it is the declared endpoint. A request
		// dated *at* the drawing frame (or in the future) would start its transition
		// there and animate exactly as usual, which is the defect this pins.
		const NOW = 12.5;
			// Dated strictly before the transition it starts, so no frame can draw it
		// mid-flight.
		expect(readingIntentClockSeconds(true, NOW)).toBeLessThan(NOW - VIEWPORT_READING_TRANSITION_SECONDS);
		expect(readingIntentClockSeconds(false, NOW)).toBe(NOW);

				const start = createViewportCameraState({
			outputId: 'output:policy',
			sessionEpoch: 'session-policy',
			sourceRevision: 'revision-policy',
			pose: { target: [0, 2, 0], azimuthRadians: 0, elevationRadians: 0.35, targetPlaneHeightMeters: 8 },
			sceneRadiusMeters: 6
		});

		const reduced = requestViewingIntent(
			start,
			{ kind: 'set-reading', reading: 'plan' },
			readingIntentClockSeconds(true, NOW)
		);
		expect(reduced.kind).toBe('accepted');
		// The frame that draws the request is the *real* clock, not the dated one: it
		// must already be the endpoint, or the creator still watched a flip.
		const reducedFrame = evaluateViewport(reduced.state, RECT, NOW, 1);
		if (reducedFrame.kind !== 'evaluated') throw new Error('the reduced-motion frame did not evaluate');
		// Rendered at the endpoint in the very frame the intent was applied.
		expect(reducedFrame.evaluation.renderedReading).toBe('plan');
		expect(reducedFrame.evaluation.progress).toBe(1);
		expect(reducedFrame.evaluation.projectionKind).toBe('plan-orthographic');

		// Positive control: the ordinary clock at the same moment is still in flight,
		// so the assertion above is about reduced motion and not about the clock
		// having been past the transition anyway.
		const ordinary = requestViewingIntent(
			start,
			{ kind: 'set-reading', reading: 'plan' },
			readingIntentClockSeconds(false, NOW)
		);
		expect(ordinary.kind).toBe('accepted');
		const ordinaryFrame = evaluateViewport(ordinary.state, RECT, NOW, 1);
		if (ordinaryFrame.kind !== 'evaluated') throw new Error('the ordinary frame did not evaluate');
		expect(ordinaryFrame.evaluation.renderedReading).toBe('transition');
	});

	it('treats a click that travelled further than the tolerance as a drag', () => {
		expect(STAGE_CLICK_TOLERANCE_CSS_PX).toBeGreaterThan(0);
		const origin = { x: 100, y: 100 };

		// A click has a little pointer jitter and is still a click: exactly at the
		// tolerance is not a drag, one pixel past it is.
		expect(isStageDrag(origin, origin)).toBe(false);
		expect(isStageDrag(origin, { x: 104, y: 100 })).toBe(false);
		expect(isStageDrag(origin, { x: 100, y: 96 })).toBe(false);
		expect(isStageDrag(origin, { x: 105, y: 100 })).toBe(true);

		// Distance is Euclidean, not per-axis: a 3-4-5 move is a drag even though
		// neither axis alone exceeds the tolerance.
		expect(isStageDrag(origin, { x: 103, y: 104 })).toBe(true);
		// Direction does not matter.
		expect(isStageDrag(origin, { x: 40, y: 160 })).toBe(true);
	});

	it('suppresses the click that follows a drag, using the real pointer order', () => {
		// The event order is pointerdown → pointerup → click, and the drag decision must
		// survive the pointer ending. Clearing the press origin in the pointer-up handler
		// (which is what a "release the gesture" helper naturally does) made every pan
		// and orbit select whatever sat under the release point.
		const press = createStagePressTracker();
		press.begin({ x: 100, y: 100 }, 1);
		press.end(1);
		expect(press.decide({ x: 260, y: 240 }, 1)).toBe(false);

		// A plain click at the same place still selects: the tolerance is unchanged.
		press.begin({ x: 100, y: 100 }, 1);
		press.end(1);
		expect(press.decide({ x: 103, y: 102 }, 1)).toBe(true);

		// One press authorizes at most one click; a second click is judged on its own.
		press.begin({ x: 300, y: 300 }, 1);
		press.end(1);
		expect(press.decide({ x: 300, y: 300 }, 1)).toBe(true);
		expect(press.decide({ x: 300, y: 300 }, 1)).toBe(true);

		// An interruption — pointer cancel, capture lost while down, Escape, a policy
		// cancel — ends the press and refuses the click the browser may still dispatch.
		press.begin({ x: 100, y: 100 }, 1);
		press.abort();
		expect(press.decide({ x: 100, y: 100 }, 1)).toBe(false);
		// …and that refusal is spent, not sticky: the next press selects normally.
		press.begin({ x: 100, y: 100 }, 1);
		press.end(1);
		expect(press.decide({ x: 100, y: 100 }, 1)).toBe(true);
	});

	it('keeps one pointer\u2019s press when a second pointer is refused', () => {
		// A second finger landing on the Stage is refused the gesture lease; before this it
		// could still end the first pointer's press (releasing its lease) and its click
		// could reach the same decision, selecting through a press it never owned.
		const press = createStagePressTracker();
		expect(press.ownsPointer(1)).toBe(false);
		expect(press.begin({ x: 100, y: 100 }, 1)).toBe('owned');
		expect(press.begin({ x: 400, y: 120 }, 2)).toBe('refused');
		expect(press.owner()).toBe(1);

		// Movement is the third event a refused pointer still produces. Its samples sit at
		// its own position, so consuming them against the owner's drag origin panned by the
		// distance between the two fingers (here 300 px) while the owner held the gesture.
		expect(press.ownsPointer(2)).toBe(false);
		expect(press.ownsPointer(99)).toBe(false);
		expect(press.ownsPointer(1)).toBe(true);

		// The second pointer going up must not end the first one's press.
		expect(press.end(2)).toBe(false);
		expect(press.owner()).toBe(1);

		// Its click is refused outright, and does not consume the first pointer's decision.
		expect(press.decide({ x: 400, y: 120 }, 2)).toBe(false);
		// The owner's own drag is still suppressed by distance.
		expect(press.decide({ x: 400, y: 120 }, 1)).toBe(false);

		// The lease-refusal path marks a pointer too, without ever granting it a press.
		press.begin({ x: 10, y: 10 }, 3);
		press.refuse(4);
		expect(press.end(3)).toBe(true);
		expect(press.decide({ x: 10, y: 10 }, 4)).toBe(false);
		expect(press.decide({ x: 10, y: 10 }, 3)).toBe(true);
	});
});
