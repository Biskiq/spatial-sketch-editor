/**
 * The Visitor first-frame observer is a scheduling proxy, not a presentation
 * proof. These cases hold the behavior that makes its mark trustworthy: it
 * waits for the renderer's own frame counter, it fires once, it never fires on
 * scheduling opportunities alone, and it gives up and cancels cleanly.
 */
import { describe, expect, it } from 'vitest';
import { observeFirstRenderedFrame } from '$lib/visitor/first-frame';

function scheduler() {
	const callbacks: (() => void)[] = [];
	const cancelled: number[] = [];
	let nextHandle = 1;
	return {
		callbacks,
		cancelled,
		requestFrame(callback: () => void): number {
			callbacks.push(callback);
			return nextHandle++;
		},
		cancelFrame(handle: number): void {
			cancelled.push(handle);
		},
		flush(): void {
			const pending = callbacks.splice(0);
			for (const callback of pending) callback();
		}
	};
}

function source(calls = 0) {
	return { info: { calls } };
}

describe('observeFirstRenderedFrame', () => {
	it('fires once, after the renderer frame counter advances', () => {
		const frames = source(7);
		const schedule = scheduler();
		const seen: number[] = [];
		observeFirstRenderedFrame({
			source: frames,
			onFrame: (frame) => seen.push(frame),
			requestFrame: schedule.requestFrame,
			cancelFrame: schedule.cancelFrame
		});

		schedule.flush();
		expect(seen).toEqual([]);

		frames.info.calls = 8;
		schedule.flush();
		expect(seen).toEqual([8]);

		frames.info.calls = 9;
		schedule.flush();
		expect(seen).toEqual([8]);
	});

	it('falls back to the legacy WebGL counter when the common counter is absent', () => {
		const frames = { info: { render: { frame: 4 } } };
		const schedule = scheduler();
		const seen: number[] = [];
		observeFirstRenderedFrame({
			source: frames,
			onFrame: (frame) => seen.push(frame),
			requestFrame: schedule.requestFrame,
			cancelFrame: schedule.cancelFrame
		});
		schedule.flush();
		expect(seen).toEqual([]);
		frames.info.render.frame = 5;
		schedule.flush();
		expect(seen).toEqual([5]);
	});

	it('does not treat scheduling opportunities as rendered frames', () => {
		const frames = source(3);
		const schedule = scheduler();
		let calls = 0;
		observeFirstRenderedFrame({
			source: frames,
			onFrame: () => {
				calls += 1;
			},
			requestFrame: schedule.requestFrame,
			cancelFrame: schedule.cancelFrame,
			maxFrames: 3
		});
		schedule.flush();
		schedule.flush();
		schedule.flush();
		expect(calls).toBe(0);
		expect(schedule.callbacks).toHaveLength(0);
	});

	it('cancels a pending observation without firing', () => {
		const frames = source(1);
		const schedule = scheduler();
		let calls = 0;
		const observer = observeFirstRenderedFrame({
			source: frames,
			onFrame: () => {
				calls += 1;
			},
			requestFrame: schedule.requestFrame,
			cancelFrame: schedule.cancelFrame
		});
		observer.cancel();
		frames.info.calls = 2;
		schedule.flush();
		expect(calls).toBe(0);
		expect(schedule.cancelled).toHaveLength(1);
	});
});
